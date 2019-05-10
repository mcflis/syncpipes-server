import * as stream from 'stream';
import * as SyncPipes from "../../app/index";
import * as xlsx from 'xlsx';

/**
 * Extracts Repositories and Issues from a github org
 */
export class ExcelExtractorService extends SyncPipes.BaseService implements SyncPipes.IExtractorService {

    /**
     * Execution context
     */
    private context: SyncPipes.IPipelineContext;

    /**
     * Output stream
     */
    private stream: stream.Readable;

    /**
     * Workbooks created in prepare
     */
    private workbooks: Array<xlsx.IWorkBook>;

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
     * Data is expected from pipeline
     *
     * @return {ExtractorServiceType}
     */
    getType(): SyncPipes.ExtractorServiceType {
        return SyncPipes.ExtractorServiceType.Passive;
    }

    prepare(context: SyncPipes.IPipelineContext, logger: SyncPipes.ILogger): Promise<any> {
        this.context = context;
        this.workbooks = [];
        // load xlsx file(s) from context
        for (let file of context.inputData) {
            this.workbooks.push(xlsx.read(file, {"type": "buffer"}));
        }
        // resolve immediately, since no async work is done
        return Promise.resolve();
    }


    extract(): stream.Readable {
        // create output stream
        this.stream = new stream.Readable({objectMode: true});
        this.stream._read = () => {
            if (this.workbooks.length === 0) {
                this.stream.push(null);
            } else {
                let workbook = this.workbooks.pop();
                let input = {};
                while (workbook != null) {
                    workbook.SheetNames.forEach((sheetName) => {
                        let worksheet = workbook.Sheets[sheetName];
                        let worksheetAsJson = xlsx.utils.sheet_to_json(worksheet);

                        input[sheetName] = [];
                        worksheetAsJson.forEach((item) => {
                            let row = {};
                            for(var k in item) {
                                row[k] = item[k];
                            }
                            input[sheetName].push(row);
                        });

                    });
                    this.stream.push(input);
                    workbook = this.workbooks.pop();
                }
                this.stream.push(null);
            }
        };
        return this.stream;
    }

    getName(): string {
        return 'ExcelExtractor';
    }

    /**
     * This extensions has no configuration
     *
     * @return {null}
     */
    getConfiguration(): SyncPipes.IServiceConfiguration {
        return null;
    }

    setConfiguration(config: SyncPipes.IServiceConfiguration): void {    }

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

    updateConfigSchema(inputData:Array<Buffer>): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.workbooks = [];
            for (let file of inputData) {
                this.workbooks.push(xlsx.read(file, {"type": "buffer"}));
            }

            let workbook = this.workbooks.pop();
            while (workbook != null) {
                workbook.SheetNames.forEach((sheetName) => {
                    let worksheet = workbook.Sheets[sheetName];
                    let worksheetAsJson = xlsx.utils.sheet_to_json(worksheet);

                    let keys = [];
                    worksheetAsJson.forEach((item) => {
                        for(var k in item)
                            if(!keys.includes(k))
                                keys.push(k);
                    });

                    let properties = {};
                    for(let i=0; i<keys.length; i++)
                        properties[keys[i]] = {"type": "string"};

                    this.schema.toObject().properties[sheetName] = {"type": "array", "items":{"type": "object", "properties":properties}};
                });

                // next workbook
                workbook = this.workbooks.pop();
            }

            resolve();
        });
    }
}
