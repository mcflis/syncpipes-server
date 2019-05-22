import * as lodash from 'lodash'

interface IObjectGraph {
    getName(): string;
    getParent(): IObjectGraph;
    toJSON(): Object;
    getAbsolutePath(): string;
}

export class ObjectGraphNode implements IObjectGraph {

    private parent: IObjectGraph;

    private children: Array<IObjectGraph>;

    private name: string;

    constructor (name: string, parent: ObjectGraphNode = null) {
        this.name = name;
        this.parent = parent;
        this.children = [];
    }

    getName(): string {
        return this.name;
    }


    getParent(): IObjectGraph {
        return this.parent;
    }

    getNodeByPrefix(prefix: string): Array<ObjectGraphNode> {
        //
        if (prefix === '') {
            let result: Array<ObjectGraphNode> = [];
            for (let child of this.children) {
                if (child instanceof ObjectGraphNode) {
                    result.push(<ObjectGraphNode>child);
                }
            }
            return result;
        }
        // handle top level array access
        if (prefix.indexOf("/") === -1 && this.name.match(/^\[[0-9+]\]$/)) {
            for (let child of this.children) {
                // handle nodes only
                if (child instanceof ObjectGraphLeaf) {
                    if (child.getName() === prefix) {
                        return [this];
                    }
                }
            }
        }
        // handle property array access
        if (prefix === '[]') {
            const children = [];
            for (let i = 0; i < this.children.length; ++i) {
                const child = this.children[i];
                if (child.getName() === `[${i}]`) {
                    children.push(child);
                }
            }
            return children;
        }
        return this._getNodeByPrefix(prefix);
    }

    private _getNodeByPrefix(prefix: string): Array<ObjectGraphNode> {
        // prefix is current node
        if (prefix === this.name) {
            return [this];
        }
        // check if we need to check
        let idx = prefix.indexOf("/");
        let current = idx === -1 ? prefix : prefix.substr(0, idx);
        let nodes = [];
        // loop over children
        for (let child of this.children) {
            // handle nodes only
            if (child instanceof ObjectGraphNode) {
                // handle array nodes
                if (child.getName().match(/^\[[0-9+]\]$/)) {
                    nodes = nodes.concat((<ObjectGraphNode>child).getNodeByPrefix(prefix));
                } else if (current === child.getName()) {
                    nodes = nodes.concat((<ObjectGraphNode>child).getNodeByPrefix(prefix.substr(idx+1)));
                }
            }
        }
        return nodes;
    }

    getLeafByName(name: string): ObjectGraphLeaf {
        for (let child of this.children) {
            if (child instanceof ObjectGraphLeaf && child.getName() === name) {
                return <ObjectGraphLeaf>child;
            }
        }
        for (let child of this.children) {
            if (child instanceof ObjectGraphNode) {
                return (child as ObjectGraphNode).getLeafByName(name);
            }
        }
        return null;
    }

    /**
     * Insert a Plain object into graph
     *
     * @param obj
     */
    insert(obj: any) {
        if (lodash.isArray(obj)) {
            if (!this.isScalarArrayDeep(obj)) {
                // iterate over items
                for (let i = 0; i < obj.length; i++) {
                    let node = new ObjectGraphNode(`[${i}]`, this);
                    node.insert(obj[i]);
                    this.children.push(node);
                }
            } else {
                this.children.push(new ObjectGraphLeaf(this.parent.getName(), obj, this));
            }
        } else if (lodash.isPlainObject(obj)) {
            // iterate over properties
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    if (lodash.isArray(obj[key])) {
                        if (!this.isScalarArrayDeep(obj[key])) {
                            let node = new ObjectGraphNode(key, this);
                            node.insert(obj[key]);
                            this.children.push(node);
                        } else {
                            let node = new ObjectGraphLeaf(key, obj[key], this);
                            this.children.push(node);
                        }
                    } else if (lodash.isPlainObject(obj[key])) {
                        let node = new ObjectGraphNode(key, this);
                        // handle child elements
                        node.insert(obj[key]);
                        this.children.push(node);
                    } else {
                        // scalar value aka. Leaf
                        this.children.push(new ObjectGraphLeaf(key, obj[key], this));
                    }

                }
            }
        } else {
            // scalar value
            this.children.push(new ObjectGraphLeaf(this.name !== null ? this.name : this.parent.getName(), obj, this));
        }
    }

    private isScalarArrayDeep(arr: Array<any>): boolean {
        for (let item of arr) {
            if (lodash.isObject(item)) {
                return false;
            }
            if (lodash.isArray(item)) {
                let result = this.isScalarArrayDeep(item);
                if (!result) {
                    return false;
                }
            }
        }

        return true;
    }

    toJSON(): Object {
        let obj = {
            "name": this.name,
            "type": "Node",
            "children": []
        };

        for (let child of this.children) {
            obj.children.push(child.toJSON());
        }

        return obj;

    };

    getAbsolutePath(): string {
        const parent = this.getParent();
        if (parent) {
            return `${parent.getAbsolutePath()}/${this.getName()}`
        }
        return this.getName();
    }
}

export class ObjectGraphLeaf implements IObjectGraph {

    private name: string;

    private value: any;

    private parent: ObjectGraphNode;

    constructor(name: string, value: any, parent: ObjectGraphNode) {
        this.name = name;
        this.value = value;
        this.parent = parent;
    }

    getName(): string {
        return this.name;
    }

    getParent(): IObjectGraph {
        return this.parent;
    }

    getValue(): any {
        return this.value;
    }

    toJSON(): Object {
        return {
            "name": this.name,
            "type": "ObjectGraphLeaf",
            "value": this.value
        };
    }

    getAbsolutePath(): string {
        const parent = this.getParent();
        if (parent) {
            return `${parent.getAbsolutePath()}/${this.getName()}`
        }
        return this.getName();
    }

    resolveToPath(toPath: string) {
        const matches = this.getAbsolutePath().match(/\[[0-9]+]/g);
        if (!matches) {
            return toPath;
        }
        const toPathTokens = toPath.split('[]').reverse();
        const relevantMatches = matches.slice(matches.length - toPathTokens.length + 1, matches.length);
        return toPathTokens.reduce((newPath, current) => {
            return `${relevantMatches.pop() || ''}${current}${newPath}`
        }, '');
    }
}
