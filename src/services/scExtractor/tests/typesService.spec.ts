import 'mocha';
import * as chai from 'chai'

import { PipelineContext, Pipeline, ConsoleLogger, IPipeline, IServiceConfig } from "./../../../app/index";
import { SocioCortexTypesExtractorService } from './../service';
import { IMapping, IMappingGroup, IPropertyMapping } from './../../../app/model/Mapping';

var assert = require('chai').assert;

const typeName = "Kontakt";

// test mapper
describe('SocioCortexTypesExtractor Test', () => {
    describe('SocioCortexTypesExtractor.extract', () => {

        /*it('should extract type with given name', function(done) {
            // disable test timeout
            //this.timeout(0);

            let pipeline = <IPipeline>{
                extractorConfig: <IServiceConfig>{
                    config: {
                        "url" : "https://server.sociocortex.com/api/v1",
                        "username" : "manoj5864@gmail.com",
                        "password" : "Password",
                        "workspace": "Sebis Kontakte"
                    }
                },
                mapping: <IMapping> {
                    "_id" : { "$oid" : "5777e9c83e9e3f3c411b4724"},
                    "name" : "SC Contacts To Otulook Contacts" ,
                    "extractorService" : "SocioCortexExtractor" ,
                    "loaderService" : "OutlookContactsLoader" ,
                    "updated" : { "$date" : "2016-07-07T12:44:22.618Z"} ,
                    "created" : { "$date" : "2016-07-02T16:20:24.313Z"} ,
                    "groups" : [ {
                        "toPrefix" : "",
                        "_id" : { "$oid" : "57794014fde2197c299d500f"},
                        "properties" : [
                            { "fromPath" : "Kontakt/First Name" , "toPath" : "GivenName" , "_id" : { "$oid" : "57794014fde2197c299d501f"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Last Name" , "toPath" : "Surname" , "_id" : { "$oid" : "57794014fde2197c299d501e"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Job Title" , "toPath" : "JobTitle" , "_id" : { "$oid" : "57794014fde2197c299d501d"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Department" , "toPath" : "Department" , "_id" : { "$oid" : "57794014fde2197c299d501c"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Company" , "toPath" : "CompanyName" , "_id" : { "$oid" : "57794014fde2197c299d501b"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/E-Mail" , "toPath" : "EmailAddress1" , "_id" : { "$oid" : "57794014fde2197c299d501a"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/E-Mail 2" , "toPath" : "EmailAddress2" , "_id" : { "$oid" : "57794014fde2197c299d5019"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Telephone Business" , "toPath" : "BusinessPhone" , "_id" : { "$oid" : "57794014fde2197c299d5018"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Telephone Mobile" , "toPath" : "MobilePhone" , "_id" : { "$oid" : "57794014fde2197c299d5017"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Groups" , "toPath" : "Categories" , "_id" : { "$oid" : "57794014fde2197c299d5016"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Web Page" , "toPath" : "BusinessHomePage" , "_id" : { "$oid" : "57794014fde2197c299d5015"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/id" , "toPath" : "id" , "_id" : { "$oid" : "577a65908e44e934314e3088"} , "foreignKey" :  null  , "uniqueKey" : true , "primaryKey" : true} ,
                            { "fromPath" : "Kontakt/Url" , "toPath" : "url" , "_id" : { "$oid" : "577a65908e44e934314e3087"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false}
                        ]} , {
                        "toPrefix" : "BusinessAddress" ,
                        "_id" : { "$oid" : "577a939ce02d51301dabf10a"} ,
                        "properties" : [
                            { "fromPath" : "Kontakt/Business Street" , "toPath" : "BusinessAddress/Street" , "_id" : { "$oid" : "577a939ce02d51301dabf10f"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Business Zip Code" , "toPath" : "BusinessAddress/PostalCode" , "_id" : { "$oid" : "577a939ce02d51301dabf10e"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Business City" , "toPath" : "BusinessAddress/City" , "_id" : { "$oid" : "577a939ce02d51301dabf10d"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Business State" , "toPath" : "BusinessAddress/State" , "_id" : { "$oid" : "577a939ce02d51301dabf10c"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Business Country" , "toPath" : "BusinessAddress/CountryOrRegion" , "_id" : { "$oid" : "577a939ce02d51301dabf10b"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/id" , "toPath" : "BusinessAddress/$foreignKey" , "_id" : { "$oid" : "577b62d1e1d3f5003ddc597d"} , "foreignKey" : "id" , "uniqueKey" : true , "primaryKey" : false}
                        ]} , {
                        "toPrefix" : "PrivateAddress" ,
                        "_id" : { "$oid" : "577a939ce02d51301dabf104"} ,
                        "properties" : [
                            { "fromPath" : "Kontakt/Home Street" , "toPath" : "PrivateAddress/Street" , "_id" : { "$oid" : "577a939ce02d51301dabf109"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Home Zip Code" , "toPath" : "PrivateAddress/PostalCode" , "_id" : { "$oid" : "577a939ce02d51301dabf108"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Home City" , "toPath" : "PrivateAddress/City" , "_id" : { "$oid" : "577a939ce02d51301dabf107"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Home State" , "toPath" : "PrivateAddress/State" , "_id" : { "$oid" : "577a939ce02d51301dabf106"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/Home Country" , "toPath" : "PrivateAddress/CountryOrRegion" , "_id" : { "$oid" : "577a939ce02d51301dabf105"} , "foreignKey" :  null  , "uniqueKey" : false , "primaryKey" : false} ,
                            { "fromPath" : "Kontakt/id" , "toPath" : "PrivateAddress/$foreignKey" , "_id" : { "$oid" : "577b62d1e1d3f5003ddc597c"} , "foreignKey" : "id" , "uniqueKey" : true , "primaryKey" : false}
                        ]}] ,
                    "__v" : 5 ,
                    "extractorServiceConfig" : "Extractor for socioCortex Contact list" ,
                    "loaderServiceConfig" : "Outlook Contacts Configuration"
                }
            };

            let logger = new ConsoleLogger();
            let context = new PipelineContext(pipeline, null);;
            let service = new SocioCortexTypesExtractorService();

            service.prepare(context, logger).then(() =>{
                service.getConfigSchema(pipeline.extractorConfig).then((config) => {
                    service.fetchTypes().then((types) => {
                        for(var i=0; i<types.length; i++) {
                            if(types[i].name === typeName) {
                                assert.isOk('everything', 'everything is ok');
                            }
                        }
                        assert.isOk(false, 'could not find the type');
                        done();
                    });
                });
            });
        });
*/
    });
});
