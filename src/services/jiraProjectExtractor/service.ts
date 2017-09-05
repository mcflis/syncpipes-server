import * as stream from 'stream';
import jiraClient = require("jira-connector");
import * as SyncPipes from "../../app/index";
import { Configuration } from './Configuration';

/**
 * Extracts Projects from a jira org
 */
export class JiraProjectExtractorService implements SyncPipes.IExtractorService {

    /**
     * Extractor configuration
     */
    private config: Configuration;

    /**
     * Execution context
     */
    private context: SyncPipes.PipelineContext;

    /**
     * jira client
     */
    private jira: any;

    /**
     * Output stream
     */
    private stream: stream.Readable;

    /**
     * SyncPipes logger instance
     */
    private logger: SyncPipes.ILogger;

    /**
     * Extension schema
     */
    private schema: SyncPipes.ISchema;

    constructor() {
        this.schema = SyncPipes.Schema.createFromFile(__dirname + '/schema.json');
    }

    /**
     * Data is fetched actively
     *
     * @return {ExtractorServiceType}
     */
    getType(): SyncPipes.ExtractorServiceType {
        return SyncPipes.ExtractorServiceType.Active;
    }

    prepare(context: SyncPipes.PipelineContext, logger: SyncPipes.ILogger): Promise<any> {
        this.context = context;
        this.config = new Configuration();
        this.logger = logger;
        this.config.load(context.pipeline.extractorConfig.config);
        this.jira = new jiraClient( {
            host: this.config.url,
            basic_auth: {
                username: this.config.username,
                password: this.config.password
            }
        });
        return Promise.resolve();
    }

    extract(): stream.Readable {
        // create output stream
        this.stream = new stream.Readable({objectMode: true});
        this.stream._read = () => {};
        console.log("fetch all projects");
        this.fetchProjects();
        return this.stream;
    }

    getName(): string {
        return 'JiraProjectExtractor';
    }

    getConfiguration(): SyncPipes.IServiceConfiguration {
        return new Configuration();
    }

    setConfiguration(config: SyncPipes.IServiceConfiguration): void {
        this.config = <Configuration>config;
    }

    /**
     * Return the schema which can be extracted
     *
     * @return {Schema}
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
    getConfigSchema(config ): Promise<SyncPipes.ISchema> {
        return new Promise<SyncPipes.ISchema>((resolve) => {
            resolve(this.schema);
        });
    }

    private fetchProjects() {
        if (this.stream === null) {
            throw new Error('No output stream available');
        } else {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
            Promise.all([this.jira.project.getAllProjects()]).then((p) => {
                this.stream.push({"projects": p[0]});
                this.stream.push(null);
            }).catch((err) => {
                console.error(err);
            });
        }
    }

    uniqueCategory(projectCategories, projectCategory) {
        for(let i=0; i<projectCategories.length; i++) {
            if(projectCategories[i].id === projectCategory.id) return false;
        }
        return true;
    }

    updateConfigSchema(inputData:Array<Buffer>) {
        return null;
    }
}