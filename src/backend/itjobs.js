const request = require('request');
const ITJOBS_KEY=process.env.ITJOBS_KEY;
const ITJOBS_URL=process.env.ITJOBS_URL || 'http://api.sandbox.itjobs.pt';

const parseSearchResults = (data) => {
  console.log("Parsing data");
  console.log(data);
  return new Promise((resolve, reject) => {
    const jobs = [];
    for(let job of data){
      let locations = '';
      if(job.locations){
        for(let location of job.locations){
          locations += `${location.name}, `
        }
        locations = locations.slice(0,-2);
      }
      let cleanBody = job.body.replace(/<br>/ig,'\n');
      cleanBody = cleanBody.replace(/<\/p>/ig,'\n');
      cleanBody = cleanBody.replace(/(<([^>]+)>)/ig,'');
      jobs.push({
        publishedAt: job.publishedAt,
        title: job.title,
        company: job.company.name,
        remote:job.allowRemote,
        locations : locations,
        id: job.id,
        body: cleanBody
      });
    }
    return resolve(jobs);
  })
}

const makeRequest = (requestOptions) => {
  return new Promise((resolve, reject) => {
    request(requestOptions, async (error, response, body)=>{
      if(error){
        console.log(error);
        return reject(error);
      }
      return resolve(body);
    });
  });
}

exports.getAllJobs = () => {
  return new Promise( async (resolve, reject) => {
    const url = `${ITJOBS_URL}/job/search.json`;
    const requestOptions = {
      url: url,
      method: 'GET',
      json: true,
      qs: {
        api_key:ITJOBS_KEY,
        q: '',
        limit: 500,
        page:1
      }
    };
    let resultsToGet = 1;
    let results = [];
    while(resultsToGet > 0){
      let response = await makeRequest(requestOptions);
      results = results.concat(response.results);
      resultsToGet = response.total - (500 * response.page);
      requestOptions.qs.page++;
    }
    resolve(results);
  });
}

exports.searchITJobs = (search, limit, page) => {
  return new Promise( (resolve, reject) => {
    const url = `${ITJOBS_URL}/job/search.json`;

    const requestOptions = {
      url: url,
      method: 'GET',
      json: true,
      qs: {
        api_key:ITJOBS_KEY,
        q: search,
        limit: limit,
        page:page
      }
    };
    console.log(`[ITJOBS] getting ${url}`);
    request(requestOptions, async (error, response, body)=>{
      if(error){
        console.log(error);
        return reject(error);
      }
      console.log(`DATA received ${typeof body}`);
      console.log(body.length);
      const parsedData = await parseSearchResults(body.results);
      const returnData = {
        meta: {
          total: body.total,
          page: body.page,
          limit: body.limit,
          query: body.query
        },
        data: parsedData
      };
      return resolve(returnData);
    }); 
  });
}


