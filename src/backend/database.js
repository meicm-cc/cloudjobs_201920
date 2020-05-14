const MongoClient = require('mongodb').MongoClient;
const bcrypt = require('bcryptjs');
const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = process.env.BD_PORT || 27017;
const dbName = process.env.DB_NAME || 'cloudjobs';
const authMechanism = 'DEFAULT';

const mongoDBOptions = {
  reconnectInterval: 1000,
  reconnectTries: 60,
  autoReconnect: true
}

// Connection URL
const url = `mongodb://${dbHost}:${dbPort}/${dbName}`;

const APP_USER_PASS = process.env.APP_USER_PASS || 'password';

const parseSearchResults = (data) => {
  console.log("Parsing data");
  return new Promise((resolve, reject) => {
    const jobs = [];
    for(let job of data){
      let locations = '';
      if(job.itjobs.locations){
        for(let location of job.itjobs.locations){
          locations += `${location.name}, `
        }
        locations = locations.slice(0,-2);
      }
      jobs.push({
        publishedAt: job.itjobs.publishedAt,
        title: job.itjobs.title,
        company: job.itjobs.company.name,
        remote:job.itjobs.allowRemote,
        locations : locations,
        id: job.itjobs.id,
        body: job.bodyCleaned
      });
    }
    
    return resolve(jobs);
  })
}

const loadDefaults = (db) => {
  return new Promise((resolve,reject) => {
    const config = db.collection('config');
    const gathererConfig = {
      type:'gatherer',
      config: {
        keywords: [
          'cloud',
          'aws',
          'gcp',
          'azure',
          'docker',
          'kubernetes',
          'serverless',
          'microservices',
          'iaas',
          'paas',
          'saas'
        ]
      }
    }
    config.find({type:'gatherer'}).toArray((err,result)=>{
      if(err) return reject(err);
      if(!result || result.length == 0) {
        config.insert(gathererConfig,(err, result) => {
          if(err) return reject(err);
          return resolve(true);
        });
      }
      return resolve(true);
    });
  });
}

const loadDefaultUser = (db) => {
  return new Promise((resolve,reject)=>{
    const users = db.collection('users');
    users.find({}).toArray((error,result)=>{
      if(error) return reject(error);
      if(!result || result.length == 0) {

        let salt = bcrypt.genSaltSync(10);
        let hash = bcrypt.hashSync(APP_USER_PASS, salt);

        users.insert({username:'admin', password:hash},(err, result) => {
          if(err) return reject(err);
          return resolve(true);
        });
      } 
      return resolve(true);
    })
  })
}

const getGathererConfig = (db) => {
  return new Promise((resolve, reject) => {
    const configCollection = db.collection('config');
    configCollection.findOne({type:'gatherer'},(err,result)=>{
      if(err) return reject(err);
      return resolve(result);
    });
  });
}


const connect = () => {
  let db;
  let client;
  console.log(`[MongoDB] connecting to: ${url}`);

  return new Promise((resolve,reject)=>{
    console.log("Connecting to "+url)

    const client = new MongoClient(url,mongoDBOptions)
    client.connect( async (err) =>  {
      if(err) {
        return reject(err);
      }
      console.log("Connected successfully to server");
      db = client.db(dbName);

      await loadDefaults(db);
      await loadDefaultUser(db);

      return resolve({
        client:client,
        db:db
      });
    });
  })
}


const getJobByITJobsID = (db, ITJobsID) => {
  return new Promise((resolve, reject) => {
    const jobs = db.collection('jobs');
    jobs.findOne({'itjobs.id': ITJobsID},(err,job) => {
      if(err) return reject(err);
      return resolve(job);
    });
  });
}

const insertJob = (db, job) => {
  return new Promise((resolve, reject) => {
    const jobs = db.collection('jobs');
    jobs.insertOne(job,(err,result) => {
      if(err) return reject(err);
      return resolve(result);
    });
  });
}

const getJobsNotUpdated = (db, today) => {
  return new Promise((resolve, reject) =>  {
    const jobs = db.collection('jobs');
    jobs.find({DGUpdatedOn: {$ne: today}, removedOn:{$exists: false} }).toArray((err,jobsNotUpdated) => {
      if(err) return reject(err);
      return resolve(jobsNotUpdated);
    });
  });
}

const updateJob = (db, job) => {
  return new Promise((resolve, reject) => {
    const jobs = db.collection('jobs');
    jobs.findOneAndReplace({_id: job._id}, job, (err, results) => {
      if(err) return reject(err);
      return resolve(results);
    });
  });
}

const searchJobs = (db, keywords,forFrontend=false) => {
  return new Promise((resolve, reject) => {
    const jobs = db.collection('jobs');
    jobs.find({removedOn:{$exists: false}, bodyCleaned: {$regex: new RegExp(keywords,'ig')}}).toArray(async (err, jobs) => {
      if(err) return reject(err);
      if(forFrontend) {
        return resolve(await parseSearchResults(jobs));
      }
      return resolve(jobs);
    });
  });
}

const getStatisticsByDay = (db, day) => {
  return new Promise((resolve, reject) => {
    const statistics = db.collection('statistics');
    statistics.findOne({date: day}, (err, statistic) => {
      if(err) return reject(err);
      return resolve(statistic);
    });
  });
}

const insertStatistics = (db, statistic) => {
  return new Promise((resolve, reject) => {
    const statistics = db.collection('statistics');
    statistics.insertOne(statistic,(err, result) => {
      if(err) return reject(err);
      return resolve(result);
    });
  });
}

const getJobs = (db) => {
  return new Promise((resolve,reject) => {
    const jobs = db.collection('jobs');
    jobs.find({removedOn:{$exists: false}}).toArray((err,documents)=>{
      if(err) return reject(err);
      return resolve(documents);
    });
  });
}

const insertGathererKeyword = (db, keyword) => {
  return new Promise((resolve, reject)=> {
    const config = db.collection('config');
    config.findOne({type:'gatherer'},(err,configDocument) => {
      if(err) return reject(err);
      console.log(keyword);
      console.log(configDocument.config.keywords);
      configDocument.config.keywords.push(keyword);
      console.log(configDocument.config.keywords);
      config.findOneAndReplace({_id:configDocument._id},configDocument,(err,results)=>{
        if(err) return reject(err);
        return resolve(results);
      });
    });
  });
}

const deleteGathererKeyword = (db, keyword) => {
  return new Promise((resolve, reject)=> {
    const config = db.collection('config');
    config.findOne({type:'gatherer'},(err,configDocument) => {
      if(err) return reject(err);

      let index = configDocument.config.keywords.indexOf(keyword);
      if (index !== -1) {
        configDocument.config.keywords.splice(index, 1);
      }
      config.findOneAndReplace({_id:configDocument._id},configDocument,(err,results)=>{
        if(err) return reject(err);
        return resolve(results);
      });
    });
  });
}


const getLatestStatistic = (db) => {
  return new Promise((resolve, reject) => {
    const statistics = db.collection('statistics');
    statistics.find().sort({date:-1}).limit(1).next((err,doc)=>{
      if(err) return reject(err);
      return resolve(doc);
    });
  });
}

const getStatistics = (db) => {
  return new Promise((resolve, reject) => {
    const statistics = db.collection('statistics');
    statistics.find({}).sort({date:-1}).limit(30).toArray((err,docs)=>{
      if(err) return reject(err);
      return resolve(docs);
    });
  });
}

module.exports = {
  connect: connect,
  getGathererConfig: getGathererConfig,
  getJobByITJobsID: getJobByITJobsID,
  insertJob: insertJob,
  getJobsNotUpdated: getJobsNotUpdated,
  updateJob: updateJob,
  searchJobs: searchJobs,
  getStatisticsByDay: getStatisticsByDay,
  insertStatistics: insertStatistics,
  getJobs: getJobs,
  insertGathererKeyword: insertGathererKeyword,
  deleteGathererKeyword: deleteGathererKeyword, 
  getLatestStatistic: getLatestStatistic,
  getStatistics: getStatistics
}
