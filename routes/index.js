const express = require('express');
const router = express.Router();

const patreon = require('patreon');
const patreonAPI = patreon.patreon;
const patreonOAuth = patreon.oauth;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const patreonOAuthClient = patreonOAuth(CLIENT_ID, CLIENT_SECRET);

const redirectURI = 'http://localhost:3000/patreon/callback';

let user = null;

function apiCall(endpoint, query){
        const apiURL = new URL("https://www.patreon.com/api/oauth2/v2/"+endpoint);
        if(query != null){
            const searchParams = new URLSearchParams(query);
            apiURL.search = searchParams.toString();
        }

        console.log(apiURL.toString());
        return fetch(apiURL, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${user.token}`
            }
        }).then((res) => {
            if(res.ok){
                return res.json();
            }else{
                return Promise.reject(new Error(res.statusText));
            }
        });
}


const loginParams = new URLSearchParams(
    {
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: redirectURI,
        scope: "identity campaigns campaigns.members campaigns.members.address"
    }
);
const loginURL = new URL("https://www.patreon.com/oauth2/authorize");
loginURL.search = loginParams.toString();


//console.log(loginURL)

router.get('/patreon/callback', (req, res) => {
    const {code} = req.query;
    let token;

    return patreonOAuthClient.getTokens(code, redirectURI)
        .then((tokenResponse) => {
            token = tokenResponse.access_token
            apiClient = patreonAPI(token);
            return apiClient('/current_user')
        })
        .then(({ store, rawJson }) => {
            const { id } = rawJson.data
            user = {
                id,
                token
            };
            console.log(id);
            return res.redirect(`/`)
        })
        .catch((err) => {
            console.log(err)
            console.log('Redirecting to login')
            res.redirect('/login')
        })
});

router.get('/login', (req, res) => {
  res.render('login', {title: 'Login', url: loginURL.toString()});
});

/* GET home page. */
router.get('/', function(req, res, next) {

  // if there is no user, redirect to login
  if (!user) {
    res.redirect('/login');
    return;
  }

  const identityQuery = {
      "fields[user]":"vanity,url,full_name"
  }

  apiCall('identity', identityQuery)
      .then(identity => {
          //console.log(JSON.stringify(identity, null, '\t'));
      })

    apiCall('campaigns',{
        "include": "tiers",
        "fields[tier]":"title,amount_cents",
        "fields[campaign]":"summary,url",
    })
        .then(campaigns => {
            console.log(JSON.stringify(campaigns, null, '\t'));
        })

    apiCall('campaigns/8603669/members',{
        "include": "address,currently_entitled_tiers",
        //"fields[user]":"currently_entitled_tiers",
    })
        .then(campaign => {
            console.log(JSON.stringify(campaign, null, '\t'));
        })


  res.render('index', { title: 'Patreon Stuff' });
});

module.exports = router;
