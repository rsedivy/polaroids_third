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

  let processedCampaigns = [];

    apiCall('campaigns',{
        "include": "tiers,creator",
        "fields[tier]":"title,amount_cents",
        "fields[campaign]":"summary,url",
        "fields[user]":"full_name"
    })
        .then(campaigns => {
            const campaignsArray = campaigns.data;
            const includes = campaigns.included;
            //console.log(JSON.stringify(campaigns, null, '\t')); // for debug purposes

            campaignsArray.forEach(campaign => {
                let fullName = includes.find(include =>
                        include.id === campaign.relationships.creator.data.id
                        && include.type === "user"
                ).attributes.full_name;

                const campaignObject = {
                    id: campaign.id,
                    title: fullName,
                    tiers: []
                };

                // the AI wrote this entire part on its own and I'm staggered
                campaign.relationships.tiers.data.forEach(tier => {
                    const tierObject = {
                        id: tier.id,
                        title: includes.find(include => include.id === tier.id && include.type === "tier").attributes.title,
                        amount: includes.find(include => include.id === tier.id && include.type === "tier").attributes.amount_cents
                    };
                    campaignObject.tiers.push(tierObject);
                });

                processedCampaigns.push(campaignObject);
            });

            res.render('index', { campaigns: processedCampaigns});
        })
        .catch(err => {
            console.log(err);
            res.render('error', {error: err});
        });
});

module.exports = router;
