/**
 * Answer banks for the 12 real-life profile questions.
 * Each question has multiple variant answers across different persona types
 * so seeded profiles feel diverse rather than identical.
 *
 * Question keys match the schema.prisma RealLifeQuestionKey enum.
 */

export type PersonaType = 'traditional' | 'modern' | 'balanced' | 'career-focused' | 'family-first';

type AnswerBank = Record<string, string[]>;

/** Question key → persona type → answer variants */
export const REAL_LIFE_ANSWERS: Record<string, Record<PersonaType, string[]>> = {
  PARENTING_STYLE: {
    traditional: [
      'I believe in raising children with strong cultural values and traditions from both sides of the family. Discipline balanced with love is key.',
      'I want my children grounded in our heritage — languages, festivals, community. A firm but loving upbringing builds character.',
    ],
    modern: [
      'Open communication and emotional intelligence matter most to me. I want children to feel safe expressing themselves.',
      'I\'d encourage independence from an early age. Critical thinking over rote learning. Lots of conversations about the world.',
    ],
    balanced: [
      'I\'d want to blend both worlds — cultural roots and modern thinking. Traditions where they add meaning, flexibility where they don\'t.',
      'Somewhere between structure and freedom. Rules that make sense, room for mistakes, and always talking things through.',
    ],
    'career-focused': [
      'I\'d prioritise education heavily but also make sure they have time to discover who they are outside of academics.',
      'Achievement matters, but so does wellbeing. I\'d push them to aim high while making sure they\'re not burning out.',
    ],
    'family-first': [
      'Family involvement in raising children is natural to me. Grandparents, aunts, uncles — the whole village.',
      'I grew up with strong family bonds and want the same for my children. Joint decisions with my partner always.',
    ],
  },

  FAITH_AND_SPIRITUALITY: {
    traditional: [
      'Faith is central to my daily life. I follow our traditions and would want a partner who respects and shares that.',
      'I pray regularly and observe festivals meaningfully. I\'d want our home to have a spiritual foundation.',
    ],
    modern: [
      'I\'m more spiritual than religious. I value the philosophy behind traditions without necessarily following rituals.',
      'I respect all faiths but don\'t practise actively myself. I\'m open to a partner who does, as long as they respect my approach.',
    ],
    balanced: [
      'I observe major festivals and find meaning in them, but I\'m not rigid about daily rituals. Faith for me is personal.',
      'Somewhere in the middle — I believe in something larger than myself but express it in my own way.',
    ],
    'career-focused': [
      'Spirituality grounds me during stressful periods. I meditate more than I pray, but the intention is similar.',
      'I value the ethical framework that faith provides even if I\'m not strictly observant.',
    ],
    'family-first': [
      'Our family\'s faith traditions bring everyone together. I\'d want to continue that in my own home.',
      'I follow our family\'s customs closely — it keeps me connected to my roots and community.',
    ],
  },

  DIET_AND_LIFESTYLE: {
    traditional: [
      'Vegetarian, always have been. I cook mostly at home using recipes from my mum\'s kitchen.',
      'I follow a vegetarian diet out of both habit and conviction. Cooking Indian food is genuinely something I love.',
    ],
    modern: [
      'I eat everything but cook mostly healthy. Meal prep on Sundays, occasional restaurant weekends.',
      'Non-vegetarian and happy about it. I love exploring cuisines — Indian, Japanese, Mediterranean, whatever\'s good.',
    ],
    balanced: [
      'Mostly vegetarian at home, more flexible when eating out. I care about quality and where food comes from.',
      'I eat a balanced diet. Indian food at home, open to everything else socially.',
    ],
    'career-focused': [
      'I keep it simple and healthy during the week. Weekends are for proper cooking or a good restaurant.',
      'Function over fuss most days. I keep nutrition in check but I\'m not obsessive about it.',
    ],
    'family-first': [
      'I cook at home most days — proper Indian food, not shortcuts. Food is how my family stays connected.',
      'We eat together as a family whenever possible. Home cooking is non-negotiable for me.',
    ],
  },

  MONEY_AND_FINANCES: {
    traditional: [
      'I believe in saving first and spending from what remains. Joint finances with clear family goals once settled.',
      'Security matters most to me. I invest conservatively and don\'t like financial surprises.',
    ],
    modern: [
      'I track my finances carefully — FIRE principles interest me. I believe in financial independence before big commitments.',
      'I invest aggressively in equities. Money is a tool and I want to use it well. Transparency with a partner is essential.',
    ],
    balanced: [
      'Good savings habits and room for enjoyment. I\'m not extreme either way — a nice holiday isn\'t extravagant, it\'s necessary.',
      'I have a budget and mostly stick to it. I\'m not frugal but I\'m not reckless either.',
    ],
    'career-focused': [
      'High earner, high saver. I have clear financial goals for the next five years and I\'m on track.',
      'I believe in earning well and living well within means. Financial conversations early in relationships matter.',
    ],
    'family-first': [
      'Family financial security is my priority. I\'d rather have a stable home than lifestyle upgrades.',
      'I plan for the long term — kids\' education, parents\' care, our retirement. Priorities in that order.',
    ],
  },

  LIVING_SITUATION: {
    traditional: [
      'I\'d prefer to live close to family — not necessarily joint family, but nearby.',
      'Close to parents if possible. Family proximity matters a great deal to me.',
    ],
    modern: [
      'Independent household, preferably in the city where we both work. Visits to family are great but I value our own space.',
      'My partner and I would build our own home together. That\'s the starting point.',
    ],
    balanced: [
      'Close to extended family is nice but not essential. Our nuclear family\'s needs come first.',
      'I\'m flexible. If family is nearby, great. If not, regular visits work fine.',
    ],
    'career-focused': [
      'I\'m location-flexible for career growth. I\'d want a partner who is too, at least in the early years.',
      'Urban living near good opportunities. Career proximity over family proximity, at least for now.',
    ],
    'family-first': [
      'Extended family involvement in daily life is something I genuinely value, not just tolerate.',
      'Ideally a larger home where parents could visit for extended periods or even stay.',
    ],
  },

  SOCIAL_LIFE: {
    traditional: [
      'I prefer smaller gatherings with people I know well. Big parties aren\'t really my thing.',
      'Close knit circle of friends and family. Quality over quantity in relationships.',
    ],
    modern: [
      'I have an active social life — friends from work, university, the gym. I\'d want a partner who\'s comfortable being social.',
      'I love hosting and meeting new people. My home is usually full on weekends.',
    ],
    balanced: [
      'A mix of cosy nights in and social weekends. Neither extreme suits me long-term.',
      'I love seeing friends regularly but I also need my quiet time. Balance is the word.',
    ],
    'career-focused': [
      'I lean more introvert during the week and social on weekends when I actually have energy.',
      'Professional networking is big for me. Personal social life is smaller but meaningful.',
    ],
    'family-first': [
      'Most of my social life revolves around family and community events. That\'s genuinely how I like it.',
      'Family gatherings, festivals, community events — that\'s my social calendar and I love it.',
    ],
  },

  CAREER_AMBITIONS: {
    traditional: [
      'I have a stable career and I\'m content. I\'m not chasing promotions at the expense of family time.',
      'Career is important but it\'s not the centre of my identity. Family and values come first.',
    ],
    modern: [
      'I\'m ambitious. I want to be excellent at what I do and I\'m actively working towards leadership.',
      'I have big career goals and I\'m honest about that. I\'d want a partner who has their own ambitions too.',
    ],
    balanced: [
      'I work hard but I also know when to switch off. My career is important without consuming everything.',
      'Career is one part of a full life. I give it serious effort but it doesn\'t define me.',
    ],
    'career-focused': [
      'Career is my primary focus right now. I\'m building something significant and that takes time and energy.',
      'I\'m at a point in my career where the next 2-3 years are critical. A partner who understands that matters.',
    ],
    'family-first': [
      'I\'d scale back career ambitions if family needs it. I\'ve done it before and wouldn\'t regret it.',
      'A good job that doesn\'t follow me home. That\'s the balance I\'m working towards.',
    ],
  },

  CHILDREN_TIMELINE: {
    traditional: [
      'Within a couple of years of getting married. I\'m not one to wait too long.',
      'Fairly soon after settling down. Family feels incomplete without children for me.',
    ],
    modern: [
      'Not in a hurry. I\'d want at least 2-3 years with my partner first. Building the relationship matters.',
      'Open to children eventually but not rushing. Career and stability need to come first for me.',
    ],
    balanced: [
      'When the time feels right — no strict timeline, but I\'m not putting it off indefinitely either.',
      'Within a reasonable timeframe. I\'d want to discuss it openly with my partner rather than having a rigid plan.',
    ],
    'career-focused': [
      'I\'d want to be more settled professionally before starting a family. Probably 3-5 years into marriage.',
      'I have a timeline in mind but I\'m flexible. The right partner matters more than the exact timing.',
    ],
    'family-first': [
      'I\'d love to start a family relatively soon. Children are a major reason I\'m looking for a partner.',
      'One to two years after marriage feels right. I\'m ready for that chapter.',
    ],
  },

  HEALTH_AND_WELLBEING: {
    traditional: [
      'I exercise regularly and eat well. Nothing extreme — walking, yoga, home cooking.',
      'I take health seriously but not obsessively. Annual check-ups, decent sleep, home-cooked food.',
    ],
    modern: [
      'Very active — gym 4-5 times a week, tracking nutrition, regular check-ins with a GP.',
      'Health is non-negotiable for me. I run, lift, and eat clean. I\'d love a partner with similar habits.',
    ],
    balanced: [
      'I keep active and eat reasonably well. Not perfect but consistently making good choices.',
      'A realistic approach — I exercise most weeks, eat well most days. Life happens.',
    ],
    'career-focused': [
      'I have to be disciplined about health because my job demands it. Exercise is stress management for me.',
      'Health is how I stay sharp. I take it seriously even when things get busy.',
    ],
    'family-first': [
      'I think about long-term health — for my children\'s sake as much as my own.',
      'Staying healthy is part of being a good parent and partner. I prioritise it accordingly.',
    ],
  },

  HOBBIES_AND_INTERESTS: {
    traditional: [
      'Cooking, reading, spending time with family. Occasionally travel within the country.',
      'Classical music, traditional dance (I used to train), cooking proper Indian recipes.',
    ],
    modern: [
      'Hiking, travelling internationally, photography, following tech. I have too many interests honestly.',
      'Reading, film (proper cinema not just blockbusters), cooking, occasional hiking.',
    ],
    balanced: [
      'A mix — I love trying new restaurants, watching good television, the occasional run, and cooking on weekends.',
      'Travel, reading, cooking, and genuinely enjoying good conversation. Simple things, done well.',
    ],
    'career-focused': [
      'When I\'m not working, I read, stay active, and try to travel somewhere new every year.',
      'A few focused interests rather than many scattered ones — I prefer depth over breadth.',
    ],
    'family-first': [
      'Things we can do together as a family — cooking, day trips, board games, festivals.',
      'I like being home. Good food, good company, watching something together in the evenings.',
    ],
  },

  SETTLEMENT_TIMELINE: {
    traditional: [
      'I\'d like to settle permanently in the UK (or current country). Going back to India isn\'t on the cards.',
      'This is home now. I\'ve built my life here and I\'m not planning to uproot it.',
    ],
    modern: [
      'Open to wherever life takes us — could be UK, could be elsewhere. Career and opportunities first.',
      'I\'d consider returning to India in 10-15 years, but for now I\'m here for the long term.',
    ],
    balanced: [
      'I\'ll stay here for the foreseeable future. India is always an option eventually but not a priority.',
      'Here for the long term, with regular trips back. The best of both worlds.',
    ],
    'career-focused': [
      'Wherever my career is strongest. I\'m not tied to a geography — opportunities matter most.',
      'Committed to where I am now but open to relocation if the right opportunity came.',
    ],
    'family-first': [
      'Close to extended family wherever possible. If that means India eventually, I\'m open to it.',
      'I\'d return to India in the long run, especially when children are older. Family proximity matters.',
    ],
  },

  FAMILY_INVOLVEMENT: {
    traditional: [
      'Family is central to every major decision. Parents\' opinion matters a great deal to me.',
      'My family is closely involved in my life. That won\'t change after marriage.',
    ],
    modern: [
      'I\'m close to my family but we make our own decisions. Boundary-setting has been important.',
      'I value family input but it doesn\'t override what my partner and I decide together.',
    ],
    balanced: [
      'Family matters but I\'ve learnt to balance their expectations with our own needs as a couple.',
      'Involved, but not intrusive. I\'d want my own family to model the same.',
    ],
    'career-focused': [
      'I stay close to family but we\'ve always been independent-minded. They raised me to think for myself.',
      'Supportive family who respects my choices. That freedom has made me closer to them, not further.',
    ],
    'family-first': [
      'I can\'t imagine making major life decisions without family involvement. That\'s just how I am.',
      'Extended family is part of our daily life and I wouldn\'t have it any other way.',
    ],
  },
};

export function getRandomAnswer(questionKey: string, persona: PersonaType): string {
  const questionAnswers = REAL_LIFE_ANSWERS[questionKey];
  if (!questionAnswers) return `I approach ${questionKey.toLowerCase().replace(/_/g, ' ')} with care and thoughtfulness.`;
  const variants = questionAnswers[persona];
  if (!variants || variants.length === 0) return 'This is something I think about deeply.';
  return variants[Math.floor(Math.random() * variants.length)]!;
}
