/**
 * Answer bank for the 3 story prompt questions.
 * Multiple variants per prompt key ensure diverse, human-feeling responses.
 *
 * Prompt keys match schema.prisma StoryPromptKey enum.
 */

export const STORY_PROMPT_ANSWERS: Record<string, string[]> = {
  LIFE_ABROAD: [
    'Moving abroad was the most disorienting thing I\'ve ever done. The first winter in London felt endless, and I spent more time on WhatsApp with my mum than I\'d like to admit. But slowly it became something I couldn\'t imagine reversing. The independence shaped me in ways I didn\'t expect. I think about home differently now — not as a place I left, but as a part of me I carry.',
    'My first year in Germany was a crash course in everything I took for granted — the food, the language, the way people queue without looking annoyed about it. I\'ve learned to navigate two worlds. Some days I feel perfectly between them. Other days I\'m homesick for something I can\'t quite name. That tension has made me more thoughtful about who I am.',
    'Australia felt enormous when I first landed. The light is different here. I\'ve built something real — friends who\'ve become family, a career I\'m proud of, a city I know street by street. But I still cook my mother\'s recipes on weekends. Some things you don\'t adapt; you just carry them forward.',
    'I came to Canada for a master\'s degree and never went back. The winters were supposed to be temporary. Now I know which streets have the best chai shops and I have opinions on which city has better biryani. Home shifted gradually. I still don\'t have a single answer to "where are you from?" — and I\'ve stopped trying to give one.',
    'Life in the UK feels normal to me now but it took years. I remember the first Diwali where I missed the noise and crowds back home. Now I organise a gathering with friends, and it\'s become its own tradition. You create home where you are, and that turns out to be a skill worth having.',
  ],

  MATCH_IDEAL_PARTNER: [
    'Someone who makes everyday things feel like a choice rather than a habit. I want us to be each other\'s sounding board, not just housemates who happen to be married. A partner who\'s secure enough to disagree with me and kind enough to listen when I\'m being unreasonable. Shared values matter more to me than shared hobbies.',
    'My ideal partner is someone I can be completely honest with — not performatively honest, but genuinely, even on the days that\'s uncomfortable. Someone who takes commitment seriously and treats it as an active choice, not a default state. I\'d want us to challenge each other and find that energising rather than exhausting.',
    'I\'m looking for someone who is curious about the world and curious about me. Who asks good questions and actually listens to the answers. Someone whose instinct is towards kindness, especially in small moments. Big gestures are easy. It\'s who you are on an ordinary Tuesday that reveals the most.',
    'A real partner — not just someone who ticks the boxes but someone I actually want to come home to. Someone who\'s ambitious but not at the cost of everything else. Who laughs easily and takes the important things seriously. Who has their own opinions and isn\'t afraid to hold them.',
    'I want someone who treats the relationship as something you build together, not something that just happens. Who has their own full life and invites me into it. Who doesn\'t need me to complete them but chooses me anyway. Mutual respect first. Everything else grows from that.',
  ],

  WEEKEND_DAY: [
    'A good Saturday starts slowly — a proper cup of chai, maybe some news, no alarms. Then a long walk somewhere green if the weather allows, or cooking something I\'ve been meaning to try. In the evening, friends for dinner or a film that someone recommended ages ago and we kept putting off. Nothing dramatic. That\'s exactly how I like it.',
    'I\'m at the farmers market by 9am. I like choosing ingredients before I know what I\'m cooking. The afternoon depends on how I feel — gym, a book, or just the kind of nap that makes you feel slightly guilty and completely restored. Evenings are for people. A decent bottle of wine and conversation that goes longer than expected.',
    'Honestly, the best weekends involve very little planning. Something spontaneous usually ends up being the highlight. Maybe a drive somewhere unfamiliar. A lunch that runs into dinner. A conversation I didn\'t see coming. I do my share of structured activities — gym, errands, cooking — but the unplanned moments are what I remember.',
    'Weekend mornings are sacred. I don\'t schedule anything before 10. After that, I\'m quite social — brunch with friends, a gallery, a market, a walk. I like cities with things happening. Evenings I prefer quieter. Good food at home, maybe something to watch, early enough to feel rested by Monday.',
    'A mix of productive and enjoyable. I might spend a few hours on something I\'ve been putting off, which clears my head, then treat myself to a proper lunch and an afternoon doing nothing with intention. Reading, music, a walk. I find that weekends work best when I don\'t try to optimise every hour.',
  ],
};

export function getRandomStoryAnswer(promptKey: string): string {
  const variants = STORY_PROMPT_ANSWERS[promptKey];
  if (!variants || variants.length === 0) {
    return 'This is something I\'ve thought about a lot and I look forward to sharing more in conversation.';
  }
  return variants[Math.floor(Math.random() * variants.length)]!;
}
