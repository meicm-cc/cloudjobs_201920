const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const passportLocal = require('passport-local').Strategy;
const passportHTTPBearer = require('passport-http-bearer').Strategy;
const bodyParser = require('body-parser');
const mongo = require('./database.js');
const agenda = require('./agenda.js');
const itJobs = require('./itjobs.js');
const path = require('path')

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const start = async () => {
  console.log("Starting Node Server")
  const app = express();
  console.log("MongoDB setup")
  const db = await mongo.connect();
  console.log("Agenda setup")
  agenda.start(db);

  passport.use(new passportLocal((username,password, done)=> {
    const users = db.db.collection('users');
    users.findOne({username:username},(err,user)=>{
      if(err) return done(err);
      if(!user) return done(null,false);
      if(!bcrypt.compareSync(password,user.password)) return done(null,false);
      return done(null,user);
    });
  }));

  passport.use(new passportHTTPBearer((token,done)=>{
    const users = db.db.collection('users');
    try{
      jwt.verify(token,JWT_SECRET);
    } catch(exception) {
      return done(exception);
    }
    users.findOne({token:token},(err,user)=>{
      if(err) return done(err);
      if(!user) return done(null,false);
      return done(null,user,{scope: 'all'});
    });
  }));

  app.use(passport.initialize());
     
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({extended: true}));

  app.use('/', express.static(path.join(__dirname, '../frontend')))

  app.post('/api/signin', passport.authenticate('local',{session:false}), async (request, response) => {
    let user = request.user;
    user.token = jwt.sign({userID:user._id},JWT_SECRET);
    const users = db.db.collection('users');
    users.findOneAndReplace({_id:user._id},user,(err,result)=> {
      if(err) return response.send({error:'db error'});
      return response.send({token:user.token});
    });
  });

  app.post('/api/search', async (request, response) => {
    let search = request.body.search;
    console.log(`Searching: ${search}`);
    let limit = request.body.limit || 10;
    let page = request.body.page || 1;
    let data = await itJobs.searchITJobs(search, limit, page);
    return response.send(data);
  });

  app.post('/api/local', async (request, response) => {
    let search = request.body.search;
    console.log(`[Local Search] ${search}`);
    let data = await mongo.searchJobs(db.db,search,true);
    return response.send(data);
  });

  app.get('/api/keywords',passport.authenticate('bearer',{session:false}), async (request, response) => {
    let configData = await mongo.getGathererConfig(db.db);
    return response.send(configData.config.keywords);
  });

  app.post('/api/keywords',passport.authenticate('bearer',{session:false}), async (request, response) => {
    let keyword = request.body.data;
    console.log(keyword);
    let result = await mongo.insertGathererKeyword(db.db, keyword);
    return response.send(result);
  });

  app.del('/api/keywords/:keyword', passport.authenticate('bearer',{session:false}), async (request, response) => {
    let keyword = request.params.keyword;
    let result = await mongo.deleteGathererKeyword(db.db, keyword);
    return response.send(result);
  });

  app.get('/api/statistics', async (request, response) => {
    return response.send(await mongo.getStatistics(db.db));
  });

  app.get('/api/statistics/latest', async (request, response) => {
    return response.send( await mongo.getLatestStatistic(db.db));
  });

  app.listen(PORT,()=> console.log(`Cloud Jobs API listening on port ${PORT}`));
}

start();

