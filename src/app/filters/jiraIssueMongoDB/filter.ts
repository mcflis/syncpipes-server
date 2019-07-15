import * as mongodb from "mongodb";

interface Document {
    name: string;
    version: number;
    fields: {
        updated: string;
    }
    [key: string]: any;
}

export async function jiraIssueMongoDBFilter<T extends Document>(db: mongodb.Db, newDocuments: T[]): Promise<T[]> {
    // TODO get d.name key from config
    const existing = await db.collection('issues').find({ $or: newDocuments.map(d => ({name: d.name})) }).toArray();
    const documentMap = existing.reduce((map: Map<string, any>, current: T) => {
        const key = current.name;
        const mapItem = map.get(key);
        // TODO get fields.updated key from config and maybe use lodash to resolve property path
        if (!mapItem || (mapItem && mapItem.fields.updated < current.fields.updated)) {
            map.set(key, current);
        }
        return map;
    }, new Map<string, any>());
    return newDocuments.filter(d => {
        const existingDocument = documentMap.get(d.name);
        if (!existingDocument) {
            // insert new items directly without checking relevant fields
            return true;
        }
        d.version = existingDocument.version + 1;
        // TODO get fields.updated key from config and maybe use lodash to resolve property path
        return existingDocument.fields.updated !== d.fields.updated;
    });
}
