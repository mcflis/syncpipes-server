import * as stream from 'stream';
import jiraClient = require("jira-connector");
import * as SyncPipes from "../../app/index";
// config
import {Configuration} from './Configuration'

/**
 * Extracts Issues from a jira org
 */
export class JiraIncrementalIssueExtractor implements SyncPipes.IExtractorService {

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
// "es6-promise": "registry:dt/es6-promise#0.0.0+20160726191732",
    prepare(context: SyncPipes.PipelineContext, logger: SyncPipes.ILogger): Promise<any> {
        this.context = context;
        this.config = new Configuration();
        this.logger = logger;
        this.config.load(context.pipeline.extractorConfig.config);
        this.jira = new jiraClient({
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
        this.stream._read = () => {
        };

        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        this.fetchIssues();

        return this.stream;
    }

    getName(): string {
        return 'JiraIncrementalIssueExtractor';
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
    getConfigSchema(config): Promise<SyncPipes.ISchema> {
        return new Promise<SyncPipes.ISchema>((resolve, reject) => {
            resolve(this.schema);
        });
    }

    private fetchIssues(startAt: Number = 0, maxResults: Number = 50): Promise<void> {
        return new Promise<any>((resolve, reject) => {
            if (this.stream === null) {
                throw new Error('No output stream available');
            }

            this.jira.search.search({
                jql: `project="${this.config.project}" ORDER BY updated ASC`,
                startAt,
                maxResults
            }, (err, fetchedIssues) => {
                if (err) {
                    reject(err);
                    this.stream.push(null);
                    return;
                }

                let nextStartAt = fetchedIssues.maxResults + fetchedIssues.startAt;

                this.stream.push({"issues": fetchedIssues.issues});
                this.logger.debug("Total number of issues: " + fetchedIssues.total);
                this.logger.debug("Last number of fetched issues: " + fetchedIssues.issues.length);
                this.logger.debug("next issue start: " + nextStartAt);

                if (nextStartAt >= fetchedIssues.total) {
                    resolve();
                    this.stream.push(null);
                    return;
                }
                process.nextTick(this.fetchIssues.bind(this, nextStartAt, maxResults));
                resolve();
            });
        });
    }

    updateConfigSchema(inputData: Array<Buffer>) {
        return null;
    }
}
