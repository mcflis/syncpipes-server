import 'mocha';

import * as chai from 'chai';
import { PipelineContext, IExtractorService, ILoaderService } from "../../../app/index";
import {JiraIssueExtractorService} from "../service";

import { Configuration } from '../Configuration'
import {ConsoleLogger} from "../../../app/service/Logger";
import {IServiceConfig} from "../../../app/model/ServiceConfig";
import {IPipeline} from "../../../app/model/Pipeline";

//import jiraClient = require('jira-connector');

//let jiraConf = new Configuration().load({url:'issues.apache.org/jira', username:"", token:"", project:"SPARK"});



// test mapper
describe('Jira extractor test', function() {

    describe('Extractor.getAllProjects', function() {


        it('should extract all issues of specific project', function (done) {
            // 30sec should be enough
            this.timeout(30000);

            //var jira = new jiraClient( {
            //    host: 'issues.apache.org/jira'
            //});
            //
            //jira.project.getAllProjects(null, function(error, projects) {
            //    console.log(projects);
            //});



            // create service
            let service = new JiraIssueExtractorService();

            // simulate application behaviour
            let extractorConfig = service.getConfiguration();
            extractorConfig.load({
                "url" : "issues.apache.org/jira",
                "username" : "",
                fields: [
                    "name",
                    "issuetype",
                    "project",
                    "timespent",
                    "fixVersions",
                    "watches",
                    "lastViewed",
                    "created",
                    "priority",
                    "versions",
                    "assignee",
                    "status",
                    "components",
                    "creator",
                    "subtasks",
                    "votes"
                ],
                "token" : "",
                "project" : "BROOKLYN"
                //"project" : "SPARK"
            });
            service.setConfiguration(extractorConfig);

            // create logger
            let logger = new ConsoleLogger();

            // prepare
            service.prepare(null, logger).then(() => {

                let stream = service.extract();
                // handle end
                stream.on('end', () => {
                    logger.info("End of stream")
                    done();
                });
                // error handling
                stream.on('error', (err) => {
                    console.error("Stream error", err);

                });

                stream.on('data', (chunk) => {
                    console.log(chunk)
                });

            });
        });

    });

});
