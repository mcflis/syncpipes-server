import * as stream from 'stream';
import * as SyncPipes from "../../app/index";
import {Configuration} from './Configuration';
import mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;

export class MongoDBLoaderService extends SyncPipes.BaseService implements SyncPipes.ILoaderService {

    /**
     * Extension config
     */
    private config: Configuration;

    private dbConnection: any = null;

    /**
     * Workflow context
     */
    private context: SyncPipes.IPipelineContext;

    /**
     * Stream provided to the framework
     */
    private stream: stream.Writable;

    /**
     * SyncPipes logger instance
     */
    private logger: SyncPipes.ILogger;

    /**
     * Extension schema
     */
    private schema: SyncPipes.ISchema;

    constructor() {
        super();
        this.schema = SyncPipes.Schema.createFromFile(__dirname + '/schema.json');
    }

    /**
     * Returns the name of the extension
     *
     * @return {string}
     */
    getName(): string {
        return 'MongoLoader';
    }

    /**
     * Returns the schema of the configuration
     *
     * @return {SyncPipes.ISchema}
     */
    getSchema(): SyncPipes.ISchema {
        return this.schema;
    }

    /**
     * Returns the configured schema
     *
     * @param config
     * @returns {Promise<SyncPipes.ISchema>}
     */
    getConfigSchema(config): Promise<SyncPipes.ISchema> {
        return new Promise<SyncPipes.ISchema>((resolve) => {
            resolve(this.schema);
        });
    }

    getConfiguration(): SyncPipes.IServiceConfiguration {
        return new Configuration();
    }

    setConfiguration(config: SyncPipes.IServiceConfiguration): void {
        this.config = <Configuration>config;
    }

    prepare(context: SyncPipes.IPipelineContext, logger: SyncPipes.ILogger): Promise<any> {
        this.context = context;
        this.logger = logger;
        return new Promise<any>((resolve, reject) => {
            this.openDbConnection(this.config.mongoUrl).then(() => {
                if(this.dbConnection) {
                    this.dbConnection.collections((err, collections) => {
                        this.logger.debug("Total number of collections: " + collections.length);
                        resolve();
                    });
                } else {
                    this.logger.error("Cannot connect to mongo!!");
                    reject();
                }
            });
        });
    }

    load(): stream.Writable {
        this.stream = new stream.Writable({objectMode: true});
        this.stream._write = (chunk, encoding, callback) => {
            const serviceBusMessage: SyncPipes.ServiceBusMessage = chunk.message;
            this.logger.debug("Data loading started", null);
            // Get the keys in the chunks; do tis in a generic way, without referring to keys explicitly
            this.insertDocuments(chunk.projectCategories, "projectCategories")
                .then(() => this.insertDocuments(chunk.projects, "projects"))
                .then(() => this.insertDocuments(chunk.issues, "issues"))
                .then(() => this.insertDocuments(chunk.decisionCategories, "decisionCategories"))
                .then(() => this.insertDocuments(chunk.qualityAttributes, "qualityAttributes"))
                .then(() => {
                    if (serviceBusMessage && serviceBusMessage.notify) {
                        this.getServiceBus().emit(serviceBusMessage.notify.name, serviceBusMessage.notify.data)
                    }
                })
                .then(() => callback())
                .catch((err) => callback(err));
        };

        const closeDb = () => {
            this.closeDbConnection();
        };

        this.stream.on('finish', closeDb);
        this.stream.on('error', closeDb);

        return this.stream;
    }

    // Open the MongoDB connection.
    openDbConnection(mongoUrl: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            MongoClient.connect(mongoUrl, (err, db: mongodb.Db) => {
                if(!err) {
                    this.dbConnection = db;
                    resolve();
                } else {
                    reject("Cannot connect to db");
                }
            });
        });
    }

    // Close the existing connection.
    closeDbConnection(): void {
        if(this.dbConnection) {
            this.dbConnection.close();
            this.dbConnection = null;
        }
    }

    // Insert a new document in the collection.
    insertDocuments(documents: Array<any>, collectionName: string): any {
        return new Promise<any>((resolve, reject) => {
            if(documents.length < 1) {
                return resolve();
            } else if (this.dbConnection) {
                let p = [];
                documents.forEach(document => {
                    p.push(this.dbConnection.collection(collectionName).insertOne(document));
                });
                Promise.all(p).then(() => {
                    resolve();
                });
            } else {
                reject();
            }
        });
    }

    // Get the count of all documents in the collection.
    /*private getDocumentCount(collectionName: string): any {
        let deferred = Q.defer();
        this.dbConnection && this.dbConnection.collection(collectionName).count((err, result) => {
            assert.equal(err, null);
            if(err) {
                deferred.reject(new Error(JSON.stringify(err)));
            }
            deferred.resolve(result);
        });
        return deferred.promise;
    }

    createDefaultCollections():  Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.dbConnection.createCollection("projects", (err) => {
                if(err) reject("Cannot create Projects collection");
                this.logger.debug("Collection Projects created!");
            });
            this.dbConnection.createCollection("issues", (err) => {
                if(err) reject("Cannot create Issues collection");
                this.logger.debug("Collection Issues created!");
            });
            this.dbConnection.createCollection("projectCategories", (err) => {
                if(err) reject("Cannot create projectCategory collection");
                this.logger.debug("Collection projectCategory created!");
            });
            resolve();
        });
    }
     */
}
