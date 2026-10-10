// The book: where each chapter starts (meters = tiles from the start) and how it plays.
// `after` credits the book a chapter is in homage to; it is shown when the chapter ends.
export const CHAPTERS = [
  {
    key: 'genre', num: 'Prologue', title: 'Genre', start: 0, theme: 'genre', music: 'bright', skin: 'grass',
    pool: { flat: 2, gap: 3, platforms: 2, spikes: 1, stairs: 1, walkers: 2, mover: 1 },
  },
  {
    key: 'tail', num: 'Chapter One', title: 'The Tail', start: 150, theme: 'noir', music: 'noir', skin: 'street',
    after: [['Gun, with Occasional Music', 1994], ['Motherless Brooklyn', 1999]],
    pool: { flat: 2, gap: 2, platforms: 2, spikes: 2, stairs: 1, walkers: 3, mover: 1, bats: 1 },
  },
  {
    key: 'stoop', num: 'Chapter Two', title: 'Stoop Ball', start: 350, theme: 'brooklyn', music: 'swing', skin: 'brownstone',
    pool: { flat: 1, gap: 2, platforms: 3, stairs: 2, walkers: 2, ball: 3, spikes: 1, bats: 1 },
  },
  {
    key: 'flight', num: 'Chapter Three', title: 'Flight, Then Less', start: 550, theme: 'flight', music: 'flight', skin: 'brownstone',
    after: [['The Fortress of Solitude', 2003]],
    pool: { gap: 3, platforms: 3, walkers: 3, bats: 2, ball: 1, stairs: 1, spikes: 1 },
  },
  {
    key: 'dream', num: 'Chapter Four', title: 'Dreamed Country', start: 750, theme: 'dream', music: 'dream', skin: 'dream',
    after: [['Amnesia Moon', 1995]],
    pool: { sign: 3, flat: 1, gap: 3, platforms: 2, stairs: 1, walkers: 1, mover: 2, bats: 1, spikes: 1 },
  },
  {
    key: 'lack', num: 'Chapter Five', title: 'The Lack', start: 950, theme: 'lack', music: 'lack', skin: 'salt', diffScale: 0.85,
    after: [['As She Climbed Across the Table', 1997]],
    pool: { lack: 4, flat: 1, gap: 2, platforms: 1, walkers: 2, bats: 1, spikes: 1 },
  },
  {
    key: 'gray', num: 'Chapter Six', title: 'The Gray', start: 1150, theme: 'gray', music: 'gray', skin: 'gray', diffScale: 0.85,
    after: [['Chronic City', 2009]],
    pool: { collapse: 4, billboard: 2, gap: 2, platforms: 2, walkers: 2, bats: 1, spikes: 1, stairs: 1 },
  },
  {
    key: 'arrest', num: 'Chapter Seven', title: 'The Arrest', start: 1350, theme: 'arrest', music: 'arrest', skin: 'plain',
    diffScale: 0.4, riseCap: 1, gapCap: 3, noDouble: true,
    after: [['The Arrest', 2020]],
    pool: { flat: 3, gap: 3, stairs: 2, platforms: 1, walkers: 1 },
  },
  {
    key: 'influence', num: 'Epilogue', title: 'Influence', start: 1550, theme: 'collage', music: 'collage', skin: 'collage',
    after: [['The Ecstasy of Influence', 2011]],
    pool: {
      flat: 1, gap: 3, platforms: 2, spikes: 1, stairs: 1, walkers: 2, mover: 1, bats: 1,
      ball: 1, collapse: 1, billboard: 1, lack: 1, sign: 1,
    },
  },
];

export const LAST_CHAPTER = CHAPTERS.length - 1;
export const SKINS = ['grass', 'street', 'brownstone', 'dream', 'salt', 'gray', 'plain'];

export function chapterIndexAt(meter) {
  let i = 0;
  while (i + 1 < CHAPTERS.length && CHAPTERS[i + 1].start <= meter) i++;
  return i;
}
