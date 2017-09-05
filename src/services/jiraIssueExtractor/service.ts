import * as stream from 'stream';
import jiraClient = require("jira-connector");
import * as SyncPipes from "../../app/index";
// config
import {Configuration} from './Configuration'

/**
 * Extracts Issues from a jira org
 */
export class JiraIssueExtractorService implements SyncPipes.IExtractorService {

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
        this.jira = new jiraClient({
            host: this.config.url,
            basic_auth: {
                username: this.config.username,
                password: this.config.password
            }
        });
        //this.github.authenticate({
        //    type: "oauth",
        //    token: this.config.token
        //});
        return Promise.resolve();
    }

    extract(): stream.Readable {
        // create output stream
        this.stream = new stream.Readable({objectMode: true});
        this.stream._read = () => {
        };

        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        this.fetchIssuesForPage();

        return this.stream;
    }

    getName(): string {
        return 'jiraIssueExtractor';
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

    private fetchIssuesForPage(next: Number = 0, maxResults: Number = 50, issues: Array<any> = []): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let fnHandle = (err, _issues) => {
                if (err) {
                    reject(err);
                } else {
                    if (next > _issues.total) {
                        this.stream.push({"issues": issues});
                        this.stream.push(null);
                        return;
                    }
                    else {
                        let nextPage = _issues.maxResults + _issues.startAt;
                        let promises = [];
                        for (let issue of _issues.issues) {
                            promises.push(new Promise<any>((resolve) => {
                                this.jira.issue.getComments({issueId: issue.id}, (err, data) => {
                                    if(data) {
                                        issue.fields.comments = data.comments;
                                        issues.push(issue);
                                    }
                                    resolve();
                                });
                            }));
                        }
                        Promise.all(promises).then(() => {
                            this.logger.debug("Total number of issues: " + _issues.total, null);
                            this.logger.debug("Number of issues per page: " + _issues.maxResults, null);
                            this.logger.debug("issues : " + nextPage + " : " + issues.length, null);
                            maxResults = _issues.total - _issues.startAt < maxResults ? _issues.total - _issues.startAt : maxResults;
                            this.fetchIssuesForPage(nextPage, maxResults, issues);
                        });
                    }
                }
            };
            if (this.stream === null) {
                throw new Error('No output stream available');
            } else {
                this.jira.search.search({
                    jql: 'project=' + "\"" + this.config.project + "\"",
                    startAt: next,
                    maxResults: maxResults
                }, fnHandle);
            }
        });
    }

    updateConfigSchema(inputData: Array<Buffer>) {
        return null;
    }
}
