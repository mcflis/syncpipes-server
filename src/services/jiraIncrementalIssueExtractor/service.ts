import * as stream from 'stream';
import JiraClient = require('jira-connector');
import * as SyncPipes from "../../app/index";
// config
import { Configuration } from './Configuration';
import * as moment from "moment";
import "moment-timezone";

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

    /**
     * Authenticated user's timezone (from Jira)
     */
    private timeZone: string;

    /**
     * Issue version attached to each fetched issue to indicate snapshot version
     */
    private issueVersion: number;

    /**
     * Utc timestamp of the moment when this issue was seen
     */
    private seenUtc: string;

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
        this.issueVersion = 1;
        this.seenUtc = moment.utc().toISOString();
        this.jira = new JiraClient({
            host: this.config.url,
            basic_auth: {
                username: this.config.username,
                password: this.config.password
            }
        });
        // TODO add error handling
        this.getServiceBus().on(SyncPipes.getServiceBusEventName(SyncPipes.ServiceBusEvent.MostRecentlyUpdated), (jiraIssueUpdatedField: string) => {
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
        const lastUpdated = this.config.lastUpdated || this.formatDate(new Date(0).toISOString());
        this.fetchTimeZone().then(() => this.fetchIssues(lastUpdated));

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

    private fetchTimeZone(): Promise<void> {
        const guessedZone = moment.tz.guess();
        return this.jira.myself.getMyself()
            .then(myself => {
                this.timeZone = myself.timeZone || guessedZone;
            })
            .catch(() => {
                this.timeZone = guessedZone;
            })
    }

    private fetchIssues(lastUpdated: string, startAt: number = 0, maxResults: number = 50): Promise<void> {
        return new Promise<any>((resolve, reject) => {
            if (this.stream === null) {
                throw new Error('No output stream available');
            }

            this.jira.search.search({
                jql: `project="${this.config.project}" AND updated >= '${lastUpdated}' ORDER BY updated ASC`,
                startAt,
                maxResults
            }, (err, fetchedIssues) => {
                if (err) {
                    reject(err);
                    this.stream.push(null);
                    return;
                }

                const issues = this.transformIssues(fetchedIssues.issues);
                const newStartAt = fetchedIssues.maxResults + fetchedIssues.startAt;
                const message = JiraIncrementalIssueExtractor.createServiceBusMessage(issues);

                this.stream.push({issues, message});
                this.logger.debug(`Total number of issues: ${fetchedIssues.total}`);
                this.logger.debug(`Last number of fetched issues: ${issues.length}`);
                this.logger.debug(`start loading issues for next batch at: ${newStartAt}`);

                if (newStartAt >= fetchedIssues.total) {
                    resolve();
                    this.stream.push(null);
                    return;
                }
                process.nextTick(this.fetchIssues.bind(this, lastUpdated, newStartAt, maxResults));
                resolve();
            });
        });
    }

    updateConfigSchema(inputData: Array<Buffer>) {
        return null;
    }

    private formatDate(isoDate: string): string {
        return moment(isoDate).tz(this.timeZone || moment.tz.guess()).format('YYYY-MM-DD HH:mm');
    }

    private static createServiceBusMessage(issues: any[]): SyncPipes.ServiceBusMessage {
        const latest = JiraIncrementalIssueExtractor.getLastUpdated(issues);
        return latest ? {
            notify: {
                name: SyncPipes.getServiceBusEventName(SyncPipes.ServiceBusEvent.MostRecentlyUpdated),
                data: latest
            }
        } : null
    }

    private static getLastUpdated(issues: any[]): string {
        return issues.map(i => i.fields.updated).sort().pop();
    }

    private transformIssues(issues: any[]): any[] {
        return issues.map(issue => {
            issue.version = this.issueVersion;
            issue.seen = this.seenUtc;
            return issue;
        })
    }
}
