/**
 * Static content banks for the state-machine bot.
 * All text is realistic Indian-diaspora community content.
 */

export const HABIT_KEYS = [
  'MORNING_ROUTINE',
  'EXERCISE',
  'HEALTHY_EATING',
  'MEDITATION',
  'READING',
  'JOURNALING',
  'LEARNING',
  'FAMILY_TIME',
  'SOCIAL_CONNECTION',
  'GRATITUDE',
] as const;

export type HabitKey = (typeof HABIT_KEYS)[number];

// ── Group post content ────────────────────────────────────────────────────────

export const GROUP_POST_TEXTS = [
  'Has anyone else found it hard to keep up with family calls when the time zones are this different? Any tips?',
  'Good morning everyone! Starting my week with a long run — hope you all have a productive one.',
  'Just tried making my grandmother\'s dal makhani from memory. Turned out surprisingly close to the real thing.',
  'Anyone else attending the Diwali community event next month? Would love to meet some of you in person.',
  'Interesting article on second-generation Indians redefining what "settling down" means. Very relatable.',
  'Quick question: how do you all handle the pressure from family back home about marriage timelines?',
  'Sharing a recipe from my mum\'s kitchen — her version of aloo paratha. DM me if you want the full recipe.',
  'Just got my citizenship! Six years in the making. Still feels surreal.',
  'Anyone else finding it harder to maintain friendships since moving abroad? Or is it just me?',
  'Had the most amazing Kerala sadya at a restaurant here. Almost as good as home!',
  'For those of you who moved here for work — how long did it take before it actually felt like home?',
  'Reminder: the monthly video call for this group is this Sunday at 4pm IST / 11:30am BST. Join us!',
  'Starting Navratri fasting this week. Anyone else in the group observing it?',
  'Finally watched RRR last night. Absolutely incredible. Highly recommend if you haven\'t seen it.',
  'Does anyone have recommendations for a good Indian grocery store in Manchester?',
  'Just got promoted at work! First South Asian in this role at the company. Small win but it matters.',
  'Thinking about visiting home for the first time in two years. Already anxious about reverse culture shock.',
  'My parents just booked flights to visit me for the first time. Three weeks of cooking for them starts now.',
  'Anyone here doing Dry January? How are you finding it?',
  'Hot take: the biryani from the local restaurant here is actually better than anything I\'ve had outside of Hyderabad.',
  'Finally signed the lease on my own flat. First time living alone after years of flat shares. Nerve-wracking.',
  'Week 3 of learning to drive and I still can\'t parallel park. Send help.',
];

// ── Group comment content ─────────────────────────────────────────────────────

export const COMMENT_TEXTS = [
  'This really resonates with me. Thanks for sharing!',
  'I\'ve felt exactly the same way. You\'re definitely not alone.',
  'Great point — hadn\'t thought about it from that angle.',
  'This is such an important conversation to have in our community.',
  'Completely agree. The adjustment is real but it gets easier.',
  'Would love to hear more about your experience with this.',
  'Ha! This is too relatable. My family calls every Sunday without fail.',
  'Congrats! That\'s a huge milestone. Well deserved.',
  'Same here. The time difference makes everything harder.',
  'Thanks for the recommendation — adding it to my list!',
  'This community is honestly such a great support system.',
  'Send me that recipe! My attempts always end in disaster.',
  'I moved here 4 years ago and still have moments like this.',
  'The food nostalgia is real. Nothing compares to home cooking.',
  'Proud of you for sharing this. More people need to talk about it.',
];

// ── Weekly prompt responses ───────────────────────────────────────────────────

export const PROMPT_RESPONSES = [
  'Living abroad has taught me that home is less a place and more a feeling — and you can build it anywhere if you put in the effort with the people around you.',
  'The moment that changed me most was my first Diwali alone in a foreign country. I realised how much of my identity was tied to the rituals I\'d taken for granted back home.',
  'My ideal weekend involves a long morning walk, a proper home-cooked meal, video calls with my parents, and enough quiet time to read something I\'ve been putting off all week.',
  'I\'m looking for someone who understands the particular loneliness of being caught between two cultures — and finds humour in it rather than letting it define them.',
  'The best thing about living abroad is the perspective it gives you. You stop taking things for granted — family, food, festivals, the sound of your mother tongue in a crowd.',
  'I think what I miss most is the ambient warmth of an extended family home — the noise, the constant chai, the sense that there\'s always someone around.',
  'My career has shaped a lot of who I am, but I try not to let it be the whole answer when someone asks "what do you do." There\'s a lot more to me than my job title.',
  'I\'d love to find a partner who\'s equally comfortable at a community Garba night as they are at a work function — someone who moves between worlds without losing themselves.',
  'The hardest part of moving abroad wasn\'t the practical stuff — it was learning to be present in a place while part of you is always somewhere else.',
  'Sundays here have a different rhythm than back home. I\'ve learned to love the quiet, but I still miss the chaos of a joint family Sunday lunch.',
  'I believe faith and practicality can coexist — I light a diya every morning but I also have a pension plan and a gym membership.',
  'My relationship with food is really a relationship with memory. Cooking a dish from home is one of the only ways I can be in two places at once.',
  'I want to build something permanent here — roots, friendships, a community — without letting go of where I came from. That balance is something I think about a lot.',
  'The funniest culture clash I experienced was being asked at work if I wanted decaf coffee. Back home, asking for decaf would get you laughed out of the kitchen.',
  'I moved here with two suitcases and a lot of assumptions about what my life would look like. Almost none of them were right, and I\'m grateful for that.',
];

// ── Connection note messages ──────────────────────────────────────────────────

export const CONNECTION_MESSAGES = [
  'Your answers really stood out to me — especially your thoughts on family and the life you\'re building here. Would love to connect.',
  'I noticed we\'re both from similar backgrounds and have a lot in common. Would be great to chat.',
  'Your profile caught my attention. Your perspective on living abroad mirrors a lot of my own experience.',
  'I loved your response to the weekly prompt. It really resonated with me. Would love to know more about you.',
  'We seem to share a lot of values. I think it\'s worth getting to know each other.',
  'Your story prompt about life abroad was beautifully written. I\'d love to connect and learn more.',
  '',  // 1 in 7 sends with no message (realistic)
];
