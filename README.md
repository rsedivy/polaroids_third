# Polaroids Third
Polaroids Third - a custom patreon rewards management system for the [Safety Third podcast Patreon page](https://www.patreon.com/safetythird).

This project is simple - William Osman needs [custom software to manage his nightmare Patreon tier](https://youtu.be/6SOiZSGtdGI?t=274). I need a ~~5 hour~~ weekend project because I am bad at time planning.

The podcast has a patreon tier where a podcast member sends out a signed polaroid every third month to a patreon. This project creates a page that grabs all members of the patreon from the patreon API, and shows a webpage that lists out when each patron should have their polaroid sent out.

I've taken "3 months" to mean 180 days, because working with dates is genuinely hell.

## Possible future features

Note: I probably won't take suggestions unless you have more than 2.66 million subscribers on YouTube (Sorry Allen/Peter)

Here are some things I *could* add if they were needed:
* Ability to mark if you've sent a patron a polaroid
  * So that you can see which polaroids have already been sent
* Proper login system to make this publicly hostable on the interwebs (instead of a locally hosted thing)
* A way to mark which podcast member is supposed to send the polaroid (on a rotating basis)

## Known issues
* You have to log in each time you run the project.
* In it's current form, this is **absolutely not safe to run on a publicly accessible server**.
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

*installation instructions will come here*

----

### On a serious note: a word about security

If used as intended (localy hosted, only run when needed and not perpetually, not run on an open port), this project should be *relatively* safe to run, but it's certainly not secure.

In other words, while there are no vulnerabilities that I know of, there are many safety risks as a result of the hasty code.

If this project is actually used, I can definitely take some time to make modifications to it to make it more secure.

### Acknowledgements
Parts of this code were written by AI (Github Copilot). All hail our robot overlords!