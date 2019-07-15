import { config } from 'dotenv';
import { Kernel } from './app/index';
import { ExcelExtractorService } from "./services/excelExtractor/service";
import { RequirementsMySQLLoaderService } from "./services/requirementsMysqlLoader/service";
import { GitHubIssueExtractorService } from "./services/githubIssueExtractor/service";
import { PureIssueLoaderService } from "./services/pureIssueLoader/service";
import { JiraIssueExtractorService } from "./services/jiraIssueExtractor/service";
import { JiraIncrementalIssueExtractor } from "./services/jiraIncrementalIssueExtractor/service";
import { JiraProjectExtractorService } from "./services/jiraProjectExtractor/service";
import { SocioCortexTypesExtractorService } from "./services/scExtractor/service";
import { SocioCortexLoaderService } from "./services/scLoader/service";
import { OutlookContactsLoaderService } from "./services/outlookContactsLoader/service";
import {MongoDBLoaderService} from "./services/MongoDBLoader/service";

// parse .env file
config({silent: true});

// init kernel
let kernel = new Kernel({
    "port": process.env.SYNCPIPES_PORT || 3010,
    "mongo": {
        "host": process.env.SYNCPIPES_MONGO_HOST || "localhost",
        "port": process.env.SYNCPIPES_MONGO_PORT || 27017,
        "user": process.env.SYNCPIPES_MONGO_USER || "guest",
        "password": process.env.SYNCPIPES_MONGO_PASSWORD || "guest",
        "database": process.env.SYNCPIPES_MONGO_DATABASE || "syncpipes",
        "isAuth": process.env.SYNCPIPES_MONGO_AUTH || false
    },
    "rabbitmq": {
        "host": process.env.SYNCPIPES_RABBIT_HOST || "localhost",
        "port": process.env.SYNCPIPES_RABBIT_PORT || 5672,
        "user": process.env.SYNCPIPES_RABBIT_USER || "guest",
        "password": process.env.SYNCPIPES_RABBIT_PASSWORD || "guest",
        "vhost": process.env.SYNCPIPES_RABBIT_VHOST || "syncpipes"
    }
});
// load extensions
kernel.loadService(new ExcelExtractorService());
kernel.loadService(new RequirementsMySQLLoaderService());
kernel.loadService(new GitHubIssueExtractorService());
kernel.loadService(new PureIssueLoaderService());
kernel.loadService(new JiraIssueExtractorService());
kernel.loadService(new JiraIncrementalIssueExtractor());
kernel.loadService(new JiraProjectExtractorService());
kernel.loadService(new SocioCortexTypesExtractorService());
kernel.loadService(new OutlookContactsLoaderService());
kernel.loadService(new SocioCortexLoaderService());
kernel.loadService(new MongoDBLoaderService());

export { kernel }
