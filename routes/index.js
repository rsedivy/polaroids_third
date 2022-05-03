const express = require('express');
const router = express.Router();

// API keys taken from .env file
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// OAuth2 Redirect - this will need to be changed if this project will be eventually hosted on a publicly accessible server
const redirectURI = 'http://localhost:3000/patreon/callback';

// User "session store"
// ⚠ This is really bad practice ⚠
// As a result this project should absolutely not be run on a server that is accessible over the open internet
// i.e. always run on a closed port.
let user = null;

// Call API endpoints
function apiCall(endpoint, query) {
    // Combine selected endpoint with API URL
    const apiURL = new URL("https://www.patreon.com/api/oauth2/v2/" + endpoint);
    // If there is a specific query, add it to the URL
    if (query != null) {
        const searchParams = new URLSearchParams(query);
        apiURL.search = searchParams.toString();
    }

    console.log(apiURL.toString()); // Logging for debugging purposes

    // Using native ndoe fetch module - this is why node 18.0.0 is required
    return fetch(apiURL, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${user.token}` // This is the token we get from the initial OAuth2 login
        }
    }).then((res) => {
        if (res.ok) {
            return res.json();
        } else {
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


    const tokenParams = new URLSearchParams(
        {
            grant_type: 'authorization_code',
            code: code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: redirectURI
        }
    );

    const tokenURL = new URL("https://www.patreon.com/api/oauth2/token");
    tokenURL.search = tokenParams.toString();

    fetch(tokenURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        }
    }).then((res) => {
        if (res.ok) {
            return res.json();
        } else {
            return Promise.reject(new Error(res.statusText));
        }
    }).then((json) => {
        token = json.access_token;
        user = {
            token: token
        };
        return apiCall("current_user");
    }).then((json) => {
        user.id = json.data.id;
        res.redirect('/');
    }).catch((err) => {
        console.log(err);
        res.redirect('/');
    });
});

router.get('/login', (req, res) => {
    res.render('login', {title: 'Login', url: loginURL.toString()});
});

/* GET home page. */
router.get('/', function (req, res, next) {

    // if there is no user, redirect to login
    if (!user) {
        res.redirect('/login');
        return;
    }

    let processedCampaigns = [];

    apiCall('campaigns', {
        "include": "tiers,creator",
        "fields[tier]": "title,amount_cents",
        "fields[campaign]": "summary,url",
        "fields[user]": "full_name"
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

            res.render('index', {campaigns: processedCampaigns});
        })
        .catch(err => {
            console.log(err);
            res.render('error', {error: err});
        });
});

let memberStore = [];

router.get('/list/:campaignId/:tierID', (req, res) => {
    const {campaignId, tierID} = req.params;

    if (!user) { // redirect if user not logged in
        res.redirect('/login');
        return;
    }

    const memberEndpoint = new URL(`https://www.patreon.com/api/oauth2/v2/campaigns/${campaignId}/members`);
    const searchParams = new URLSearchParams({
        "include": "address,currently_entitled_tiers",
        "fields[member]": "full_name,pledge_relationship_start",
        "fields[address]": "country,state,city,postal_code,line_1,line_2",
    });
    memberEndpoint.search = searchParams.toString();

    memberStore = []; // clear out the member store before each new request
    getMembersPage(memberEndpoint.toString())
        .then(() => {
            const TESTING = false;

            // memberStore should be populated with all the members now

            let membersArray = memberStore.filter(m =>
                m.tiers.includes(tierID)
            ); // filter all members who do not meet the tier requirements

            if (TESTING) {
                membersArray = testDataGenerator();
            }

            // set max date to one year from now
            const maxDate = new Date();
            maxDate.setFullYear(maxDate.getFullYear() + 1);

            membersArray.forEach(member => {
                member.polaroidDates = [];
                const memberDate = new Date(member.pledge_relationship_start);
                while (true) {
                    memberDate.setDate(memberDate.getDate() + 90);
                    if (memberDate > maxDate) {
                        break;
                    }
                    member.polaroidDates.push(new Date(memberDate));
                }
            });

            //console.log(JSON.stringify(membersArray[0].polaroidDates));

            const aggregatedDates = [{
                date: new Date(),
                members: [],
                relative: 0
            }];
            membersArray.forEach(member => {
                member.polaroidDates.forEach(date => {

                    let existingDate = aggregatedDates.findIndex(d =>
                        d.date.getFullYear() === date.getFullYear() &&
                        d.date.getMonth() === date.getMonth() &&
                        d.date.getDate() === date.getDate()
                    )

                    if (existingDate === -1) {
                        const today = new Date();
                        let relative;
                        if (date.getFullYear() === today.getFullYear() &&
                            date.getMonth() === today.getMonth() &&
                            date.getDate() === today.getDate()) {

                            relative = 0;
                        } else {
                            if(date > today){
                                relative = 1;
                            }else{
                                relative = -1;
                            }
                        }

                        aggregatedDates.push({
                            date: date,
                            members: [member],
                            relative: relative
                        });
                    } else {
                        aggregatedDates[existingDate].members.push(member);
                    }
                })
            })

            aggregatedDates.sort((a, b) => {
                if (a.date > b.date) {
                    return 1;
                } else if (a.date < b.date) {
                    return -1;
                } else {
                    return 0;
                }
            });

            //console.log(JSON.stringify(aggregatedDates, null, '\t'));

            res.render('list', {dates: aggregatedDates});
        })
        .catch(err => {
            console.log(err);
            res.render('error', {error: err});
        });
})

function memberAPICall(endpoint) {
    const apiURL = new URL(endpoint);
    console.log(apiURL.toString());
    return fetch(apiURL, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${user.token}`
        }
    }).then((res) => {
        if (res.ok) {
            return res.json();
        } else {
            return Promise.reject(new Error(res.statusText));
        }
    });
}

function getMembersPage(endpoint) {
    return memberAPICall(endpoint)
        .then(members => {
            const membersArray = members.data;
            const includes = members.included;
            //console.log(JSON.stringify(members, null, '\t')); // for debug purposes


            membersArray.forEach(member => {
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


            if (members.links?.next) {
                return getMembersPage(members.links.next);
            } else {
                console.log('No more member pages');
            }

        })
        .catch(err => {
            console.log(err);
            return Promise.reject(err);
        });
}

function testDataGenerator() {
    const membersArray = [
        {
            "fullName": "test",
            "pledge_relationship_start": new Date("2022-04-29T07:05:01.573Z"),
            "tiers": [
                "8581877"
            ],
        },
    ];

    for (let i = 0; i < 100; i++) {
        let dateOffset;
        // set dateOffset to a random number between 0 and 100
        if (i === 0) {
            dateOffset = 0;
        } else {
            dateOffset = Math.floor(Math.random() * 100);
        }

        const startDate = new Date("2022-01-29T07:05:01.573Z");
        startDate.setDate(startDate.getDate() + dateOffset);

        membersArray.push({
            "fullName": `John Doe${i}`,
            "pledge_relationship_start": startDate,
            "tiers": [
                "8581877"
            ],
            "address": {
                "country": "US",
                "state": "CA",
                "city": "San Francisco",
                "postal_code": "94107",
                "line_1": "123 Main St",
                "line_2": "Suite 100"
            }
        })
    }

    return membersArray;
}

module.exports = router;
