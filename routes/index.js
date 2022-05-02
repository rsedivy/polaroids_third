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

let memberStore = [];

router.get('/list/:campaignId/:tierID', (req,res) => {
    const {campaignId, tierID} = req.params;

    if(!user){ // redirect if user not logged in
        res.redirect('/login');
        return;
    }

/*    apiCall(`campaigns/${campaignId}/members`, {
        "include": "address,currently_entitled_tiers,user",
        "fields[user]":"full_name"
    })
        .then(members => {
            const membersArray = members.data;
            const includes = members.included;
            console.log(JSON.stringify(members, null, '\t')); // for debug purposes




            res.render('list', );
        })
        .catch(err => {
            console.log(err);
            res.render('error', {error: err});
        });*/
    const memberEndpoint = new URL(`https://www.patreon.com/api/oauth2/v2/campaigns/${campaignId}/members`);
    const searchParams = new URLSearchParams({
        "include": "address,currently_entitled_tiers",
        "fields[member]":"full_name,pledge_relationship_start",
        "fields[address]":"country,state,city,postal_code,line_1,line_2",
    });
    memberEndpoint.search = searchParams.toString();

    memberStore = []; // clear out the member store before each new request
    getMembersPage(memberEndpoint.toString())
        .then(() => {
            // memberStore should be populated with all the members now

            const membersArray = memberStore.filter(m =>
                m.tiers.includes(tierID)
            ); // filter all members who do not meet the tier requirements

            res.render('list', {members: membersArray});
        })
        .catch(err => {
            console.log(err);
            res.render('error', {error: err});
        });
})

function memberAPICall(endpoint){
    const apiURL = new URL(endpoint);
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

function getMembersPage(endpoint){
        return memberAPICall(endpoint)
            .then(members => {
                const membersArray = members.data;
                const includes = members.included;
                console.log(JSON.stringify(members, null, '\t')); // for debug purposes


                membersArray.forEach(member =>{
                    const memberObject = {
                        fullName: member.attributes.full_name,
                        pledge_relationship_start: new Date(member.attributes.pledge_relationship_start),
                        address: includes.find(include => include.id === member.relationships.address?.id && include.type === "address")?.attributes.address,
                        tiers: []
                    };

                    member.relationships.currently_entitled_tiers.data.forEach(tier => {
                        memberObject.tiers.push(tier.id);
                    });

                    memberStore.push(memberObject);
                });


                if(members.links?.next){
                    return getMembersPage(members.links.next);
                }else{
                    console.log('No more member pages');
                }

            })
            .catch(err => {
                console.log(err);
                return Promise.reject(err);
            });
}

module.exports = router;
