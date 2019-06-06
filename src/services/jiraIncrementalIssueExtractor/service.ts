import * as stream from 'stream';
import * as url from 'url';
import JiraClient = require('jira-connector');
import * as SyncPipes from "../../app/index";
// config
import { Configuration } from './Configuration';
import * as moment from "moment";
import "moment-timezone";
import delay from '../../app/helper/delay';

interface PipelineState extends SyncPipes.IPipelineState {
    mostRecentJiraTicketUpdated: string;
}

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
        const {protocol, host, port, pathname, href} = url.parse(this.config.url);
        this.jira = new JiraClient({
            host: host || href,
            port,
            protocol,
            path_prefix: host ? pathname : null,
            basic_auth: {
                username: this.config.username,
                password: this.config.jiraHost || this.config.password
            }
        });
        // TODO add error handling
        this.getServiceBus().on(SyncPipes.getServiceBusEventName(SyncPipes.ServiceBusEvent.MostRecentlyUpdated), (jiraIssueUpdatedField: string) => {
            if (jiraIssueUpdatedField) {
                const newState: PipelineState = {
                    mostRecentJiraTicketUpdated: this.formatDate(jiraIssueUpdatedField)
                };
                this.logger.info(`Storing timestamp of most recently updated Jira ticket: ${newState.mostRecentJiraTicketUpdated}`);
                Object.assign(this.context.pipeline.state, newState);
                SyncPipes.Pipeline.findById(this.context.pipeline._id.toString()).exec()
                    .then((pipeline: SyncPipes.IPipeline) => {
                        pipeline.state = Object.assign({}, pipeline.state, this.context.pipeline.state);
                        pipeline.save(err => {
                            if (err) {
                                this.logger.error(err);
                                return;
                            }
                            this.logger.info(`Storing timestamp of most recently updated Jira ticket was successful`);
                        });
                    }, (err) => {
                        this.logger.error(err);
                    });
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
        const pipelineState: PipelineState = this.context.pipeline.state as PipelineState;
        this.fetchTimeZone()
            .then(() => pipelineState.mostRecentJiraTicketUpdated || this.formatDate(new Date(0).toISOString()))
            .then(lastUpdated => {
                const jql = `project="${this.config.project}" AND updated >= '${lastUpdated}' ORDER BY updated ASC`;
                this.logger.info(`About to fetch issues last updated at ${lastUpdated}`);
                this.logger.info(`Fetch using JQL: ${jql}`);
                return this.fetchIssues(jql, lastUpdated)
            })
            .catch(err => this.logger.error(err));

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

    private fetchIssues(jql: string, lastUpdated: string, startAt: number = 0, maxResults: number = 50): Promise<void> {
        return new Promise<any>((resolve, reject) => {
            if (this.stream === null) {
                throw new Error('No output stream available');
            }

            this.jira.search.search({jql, startAt, maxResults}, (err, fetchedIssues) => {
                if (err) {
                    this.stream.push(null);
                    reject(err);
                    return;
                }

                const issues = this.transformIssues(fetchedIssues.issues);
                const newStartAt = fetchedIssues.maxResults + fetchedIssues.startAt;
                const message = JiraIncrementalIssueExtractor.createServiceBusMessage(issues);

                this.stream.push({issues, message});
                this.logger.info(`Fetched issues: current/aggregated/total: ${issues.length}/${Math.min(newStartAt, fetchedIssues.total)}/${fetchedIssues.total}`);

                if (newStartAt >= fetchedIssues.total) {
                    resolve();
                    this.stream.push(null);
                    return;
                }
                process.nextTick(() => delay(this.config.backoffInMs)
                    .then(() => this.fetchIssues(jql, lastUpdated, newStartAt, maxResults))
                    .catch(err => this.logger.error(err))
                );
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
            },
            filter: {
                'issues': SyncPipes.Filters.jiraIssueMongoDBFilter
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
