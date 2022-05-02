# Polaroids Third
Polaroids Third - a custom patreon rewards management system for the [Safety Third podcast Patreon page](https://www.patreon.com/safetythird).

![GIF showing the project being used.](https://raw.githubusercontent.com/rsedivy/polaroids_third/main/public/images/usage.gif "Usage gif") 

This project is simple - William Osman needs [custom software to manage his nightmare Patreon tier](https://youtu.be/6SOiZSGtdGI?t=274). I need a ~~5 hour~~ weekend project because I am bad at time planning.

The podcast has a patreon tier where a podcast member sends out a signed polaroid every third month to a patreon. This project creates a page that grabs all members of the patreon from the patreon API, and shows a webpage that lists out when each patron should have their polaroid sent out.

I've taken "3 months" to mean 90 days, because working with the day of the month is a task that belongs to Dante's 69th circle of hell.

## Possible future features

Note: I probably won't take suggestions unless you have more than 2.66 million subscribers on YouTube (Sorry Allen/Peter)

Here are some things I *could* add if they were needed:
* Ability to mark if you've sent a patron a polaroid
  * So that you can see which polaroids have already been sent
* Show the patrons you need to send polaroids to on a per-week basis rather than daily.
* Proper login system to make this publicly hostable on the interwebs (instead of a locally hosted thing)
* A way to mark which podcast member is supposed to send the polaroid (on a rotating basis)

## Known issues
* You have to log in each time you run the project.
* This code only counts continuous patreon membership.
  * This is not a bug, it's a feature!
* In its current form, this is **absolutely not safe to run on a publicly accessible server**.
  * Run it locally only.
* There's lots of bad practices in this code which I can't be bothered to fix.
  * Then again, having a (relatively mundane) patreon reward that requires a custom software solution sounds like bad practice to me too.
* If you have a lot of patreon members (e.g 860+), it'll take a while for the list of members to load
  * This is a result of patreon's API only allowing me to load users in batches of 20 or so.
  * If this actually gets used I can change this so that it lazy-loads them in while you look at the page. Doesn't change anything about the speed but it makes it a nicer user experience.

----

**Common sense warning**  
This project is clearly a very quickly thrown together thing, and I'm a random dude from the internets. Please read the code before doing something unwise, like plugging your Patreon API key or logging in via OAuth into a random nodejs project you got off of github.

Also, I take no liability if your house burns down as a result of my code. The [license](https://github.com/rsedivy/polaroids_third/blob/main/LICENSE) has more info on this.

## Installation

### Node.js

Install [node.js 18.0.0](https://nodejs.org/en/download/current/) or higher.  

*This version just came out, so you probably don't have it downloaded even if you have node.*

### Download this project from github

Either as a .zip file top left or by doing  
`git clone https://github.com/rsedivy/polaroids_third.git`

### Install dependencies

Open the polaroids_third folder in your terminal of choice, and run `npm ci`.

### Register your patreon API key

1) Go to https://www.patreon.com/portal/registration/register-clients
2) Click "Create Client"
3) Choose an app name, and fill out the non-required fields if you want to
4) Ensure that the `Redirect URI` is set to `http://localhost:3000/patreon/callback` **(⚠ Important!)**
5) Ensure that the `Client API Version` is set to `2` **(⚠ Important!)**

![An example how to fill out the "Create Client" form](https://raw.githubusercontent.com/rsedivy/polaroids_third/main/public/images/patreon_config.PNG "Patreon API key form")

### Copy down your credentials

In the clients section, you will see a `Client ID` and `Client Secret` field. You will need them in the next step.

 ![An example of how the credentials look like.](https://raw.githubusercontent.com/rsedivy/polaroids_third/main/public/images/apikeys_obscured.PNG "API key example")

### Run the project

Run the project with `npm start`.
If it's your first time running the project, you will be prompted to enter the credentials from the previous step.

### Done!

The project should automatically open your default browser and redirect you to the app!  
*(If not, just navigate to *`localhost:3000`* in your browser)*  

You will have to log in via Patreon again, and provide permission for the app to see your patron list and addresses.

Afterwards, just select the tier that you want to view (I don't know your Patreon tier ID beforehand), and you're good to go!

----

### On a serious note: a word about security

If used as intended (localy hosted, only run when needed and not perpetually, not run on an open port), this project should be *relatively* safe to run, but it's certainly not secure.

In other words, while there are no vulnerabilities that I know of, there are many safety risks as a result of the hasty code.

If this project is actually used, I can definitely take some time to make modifications to it to make it more secure.

### Acknowledgements
Parts of this code were written by AI (Github Copilot). All hail our robot overlords!

---

*This project is not affiliated with Polaroid™, Polaroid Corporation, or Polaroid B.V. All trademarks are the property of their respective owners.*