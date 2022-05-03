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
            return res.json(); // Returns a promise with the JSON data
        } else {
            return Promise.reject(new Error(res.statusText)); // I need to set up actual error handling
        }
    });
}

// Required parameters to generate the login URL
const loginParams = new URLSearchParams(
    {
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: redirectURI,
        scope: "identity campaigns campaigns.members campaigns.members.address"
        /*
            identity - to display who is logged in
            campaigns - to get the user's active campaigns
            campaigns.members - to list out the active members of the patreon camapign
            campaigns.members.address - to get the user's address
         */
    }
);
const loginURL = new URL("https://www.patreon.com/oauth2/authorize");
loginURL.search = loginParams.toString(); // combine the login parameters with the login URL


//console.log(loginURL)

router.get('/patreon/callback', (req, res) => {
    const {code} = req.query;
    let token;

    // Once an access code is received, we need to exchange it for an access token
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
    tokenURL.search = tokenParams.toString(); // combine the token parameters with the token URL

    fetch(tokenURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded" // required
        }
    }).then((res) => {
        if (res.ok) {
            return res.json();
        } else {
            return Promise.reject(new Error(res.statusText));
        }
    }).then((json) => {
        /*
            For now we just take the access token and store it in the user session
            We use that to get the user's data
         */
        token = json.access_token;
        user = {
            token: token
        };
        return apiCall("current_user");
    }).then((json) => {
        // And then we can get the user's ID and user data.
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

    // This will store the user's campaigns
    // The data we get is in the JSON:API specification, which means that you need to first
    // parse and combine annoying data relationships
    let processedCampaigns = [];

    // list out the fields we want from the API - Patroen API requires all fields to be explicitly declared.
    apiCall('campaigns', {
        "include": "tiers,creator",
        "fields[tier]": "title,amount_cents",
        "fields[campaign]": "summary,url",
        "fields[user]": "full_name"
    })
        .then(campaigns => {
            // separate the data and included relationships.
            const campaignsArray = campaigns.data;
            const includes = campaigns.included;
            //console.log(JSON.stringify(campaigns, null, '\t')); // for debug purposes


            campaignsArray.forEach(campaign => {
                // add the full name of the creator to the campaign.
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
                // Get all the tiers for each campaign and add it to the tiers array in each campaign object
                campaign.relationships.tiers.data.forEach(tier => {
                    const tierObject = {
                        id: tier.id,
                        title: includes.find(include => include.id === tier.id && include.type === "tier").attributes.title,
                        amount: includes.find(include => include.id === tier.id && include.type === "tier").attributes.amount_cents
                    };
                    campaignObject.tiers.push(tierObject);
                });
                // add to the processedCampaigns array
                processedCampaigns.push(campaignObject);
            });

            res.render('index', {campaigns: processedCampaigns});
        })
        .catch(err => {
            console.log(err);
            res.render('error', {error: err});
        });
});

// While processing the members data, they will be stored in a global variable here
// this is Bad Practice™ because it can lead to a race condition
// however, due to the previously mentioned user session issue, this is pretty much a moot point
// I don't expect more than one user to access the server at a time.
let memberStore = [];

router.get('/list/:campaignId/:tierID', (req, res) => {
    const {campaignId, tierID} = req.params; // Grab the campaign ID and tier ID from the requested URL

    if (!user) { // redirect if user not logged in
        res.redirect('/login');
        return;
    }

    // Set up initial endpoint to call the API
    // We can't use the apiCall function here because it's a recursive-ish call and so we need to pass
    // the full URL to the API rather than combining it in the apiCall function.
    const memberEndpoint = new URL(`https://www.patreon.com/api/oauth2/v2/campaigns/${campaignId}/members`);
    const searchParams = new URLSearchParams({
        "include": "address,currently_entitled_tiers",
        "fields[member]": "full_name,pledge_relationship_start",
        "fields[address]": "country,state,city,postal_code,line_1,line_2",
    });
    memberEndpoint.search = searchParams.toString(); // add the search parameters to the URL

    memberStore = []; // clear out the member store before each new request
    getMembersPage(memberEndpoint.toString())
        .then(() => { // once this then is called, we should have all the members.

            // if set to true, this will overwrite the memberStore with randomly generated data for testing purposes.
            const TESTING = false;

            // filter all members who do not meet the tier requirements
            let membersArray = memberStore.filter(m =>
                m.tiers.includes(tierID)
            );

            if (TESTING) {
                // overwrite membersArray with randomly generated data
                membersArray = testDataGenerator();
            }

            // set max date to one year from now
            // This how long into the future we will show data for
            const maxDate = new Date();
            maxDate.setFullYear(maxDate.getFullYear() + 1);

            // Generate a list of dates in multiples of 90 days from the start of the member's pledge relationship
            // reminder: pledge_relationship_start only counts since the start of the last pledge chain. If they
            // miss a payment or stop their membership, this will reset.
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

            // now we need change the data into the reference frame of:
            // "which patrons need a polaroid sent at each of these dates"
            const aggregatedDates = [{
                date: new Date(), // Initially add only today's date.
                members: [],
                relative: 0
            }];
            membersArray.forEach(member => {
                member.polaroidDates.forEach(date => {

                    // For each member, check if the date is already in the list of aggregated dates.
                    let existingDate = aggregatedDates.findIndex(d =>
                        d.date.getFullYear() === date.getFullYear() &&
                        d.date.getMonth() === date.getMonth() &&
                        d.date.getDate() === date.getDate()
                    )

                    // if not, create a new array entry for this date, and add this user to the list
                    if (existingDate === -1) {
                        const today = new Date();

                        // check where this date is relative to today
                        // -1 means it's in the past, 0 means it's today, 1 means it's in the future
                        // this is used for formatting the date in the frontend.
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
                        // if this date is already in the array, add this user to the members list
                        aggregatedDates[existingDate].members.push(member);
                    }
                })
            })

            // sort the aggregatedDates array by date.
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

// Another API call function
// This one doesn't format the endpoint for you, and instead calls the provided endpoint parameter directly
// This is needed for the recursive getMembersPage() function
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

/*
 * This is a recursive function to get a list of all the members
 * The Patreon API by default only sends a list of 20 members at a time, using pagination.
 * This is incredibly annoying, which means that a patreon with a lot of members will take a while to load
 * Eventually I can switch this an API endpoint so that the user can load in the page initially and then lazy load the rest.
 * It won't speed anything up but it'll make it a lot more user friendly
*/
function getMembersPage(endpoint) {
    return memberAPICall(endpoint)
        .then(members => {
            const membersArray = members.data; // split includes and data
            const includes = members.included;
            //console.log(JSON.stringify(members, null, '\t')); // for debug purposes


            membersArray.forEach(member => {
                // grab address and tiers by ID from the includes array

                const memberObject = {
                    fullName: member.attributes.full_name,
                    pledge_relationship_start: new Date(member.attributes.pledge_relationship_start),
                    address: includes.find(include => include.id === member.relationships.address?.id && include.type === "address")?.attributes.address,
                    tiers: []
                };

                member.relationships.currently_entitled_tiers.data.forEach(tier => {
                    memberObject.tiers.push(tier.id);
                });

                // add it to the global memberStore
                memberStore.push(memberObject);
            });

            /*
             * If there are more pages, the server will send a links object with an API URL endpoint to get the next page
             * If this object exists, we recursively call this function with the new endpoint
             * If the project doesn't work, it's likely here, because I don't have access to a patreon creator account with more than 20 members :(
             */
            if (members.links?.next) {
                return getMembersPage(members.links.next);
            } else {
                // if there are no more pages, we're done, and .then() in the router function should be called.
                console.log('No more member pages');
            }

        })
        .catch(err => {
            console.log(err);
            return Promise.reject(err);
        });
}

/**
 * This function will generate a randomized list of test data.
 * @returns {[{tiers: string[], fullName: string, pledge_relationship_start: Date}]}
 */
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
