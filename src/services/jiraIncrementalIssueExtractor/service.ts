import * as stream from 'stream';
import jiraClient = require("jira-connector");
import * as SyncPipes from "../../app/index";
// config
import {Configuration} from './Configuration';

/**
 * Extracts Issues from a jira org
 */
export class JiraIncrementalIssueExtractor extends SyncPipes.BaseService implements SyncPipes.IExtractorService {

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
        super();
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
        // TODO add error handling
        this.serviceBus.on(SyncPipes.getServiceBusEventName(SyncPipes.ServiceBusEvent.MostRecentlyUpdated), (jiraIssueUpdatedField: string) => {
            console.log('this.serviceBus.on', jiraIssueUpdatedField);
            console.log('context.pipeline.extractorConfig.id', context.pipeline.extractorConfig._id);
            const updatedConfig = this.config.store();
            updatedConfig.lastUpdated = this.formatDate(jiraIssueUpdatedField);
            SyncPipes.ServiceConfig.findByIdAndUpdate(context.pipeline.extractorConfig._id.toString(), {config: updatedConfig}, (err: any, res: any) => {
                if (err) {
                    this.logger.error(err);
                }
            })
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

                let newStartAt = fetchedIssues.maxResults + fetchedIssues.startAt;

                this.stream.push({"issues": fetchedIssues.issues});
                this.logger.debug(`Total number of issues: ${fetchedIssues.total}`);
                this.logger.debug(`Last number of fetched issues: ${fetchedIssues.issues.length}`);
                this.logger.debug(`start loading issues for next batch at: ${newStartAt}`);

                if (newStartAt >= fetchedIssues.total) {
                    resolve();
                    this.stream.push(null);
                    return;
                }
                process.nextTick(this.fetchIssues.bind(this, newStartAt, maxResults));
                resolve();
            });
        });
    }

    updateConfigSchema(inputData: Array<Buffer>) {
        return null;
    }

    private formatDate(isoDate: string): string {
        const d = new Date(isoDate);
        const yyyy = d.getUTCFullYear();
        const MM = `0${d.getUTCMonth() + 1}`.slice(-2);
        const dd = `0${d.getUTCDate()}`.slice(-2);
        const HH = `0${d.getUTCHours()}`.slice(-2);
        const mm = `0${d.getUTCMinutes()}`.slice(-2);
        return `${yyyy}-${MM}-${dd} ${HH}:${mm}`;
    }
}
