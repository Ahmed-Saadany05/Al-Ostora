/**
 * One real photograph per past mission, shown on its card in place of the 3D-model preview (which stays as the fallback).
 * Files in public/mission-photos/, cropped to the card's 16:10 slot. Credits are repeated on /about and in refaey/SOURCES.md.
 */
export interface MissionPhoto {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** The credit line printed on the card. */
  credit: string;
  /** The page the image was confirmed on. */
  source: string;
}

export const MISSION_PHOTOS: Record<string, MissionPhoto> = {
  'apollo-11': {
    src: '/mission-photos/apollo-11.webp',
    width: 1200,
    height: 750,
    alt: 'Apollo 11 bootprint in lunar soil',
    credit: 'NASA',
    source: 'https://www.nasa.gov/image-detail/amf-as11-40-5878/',
  },
  'apollo-15': {
    src: '/mission-photos/apollo-15.webp',
    width: 1200,
    height: 750,
    alt: 'The Apollo 15 lunar rover alone on the plain, with Mount Hadley behind it',
    credit: 'NASA',
    source: 'https://stars.library.ucf.edu/nasa-photographs-volume-2/70',
  },
  'lunokhod-1': {
    src: '/mission-photos/lunokhod-1.webp',
    width: 620,
    height: 387,
    alt: 'Lunokhod 1 rover and its tracks on Mare Imbrium, seen from lunar orbit',
    credit: 'NASA/GSFC/Arizona State University',
    source: 'https://lroc.im-ldi.com/images/402',
  },
  'change-4': {
    src: '/mission-photos/change-4.webp',
    width: 1200,
    height: 750,
    alt: "The Chang'e 4 lander on the far side of the Moon, photographed by the Yutu-2 rover",
    credit: 'CNSA/CLEP/NAOC',
    source: 'https://www.dlr.de/en/images/2020/3/chang-e-4-lunar-lander-imaged-by-the-yutu-2-rover',
  },
  'chandrayaan-3': {
    src: '/mission-photos/chandrayaan-3.webp',
    width: 1125,
    height: 703,
    alt: 'The Chandrayaan-3 Vikram lander on the lunar surface, seen by the Pragyan rover on 30 August 2023',
    credit: 'ISRO',
    source: 'https://www.isro.gov.in/chandrayaan3_gallery.html',
  },
  athena: {
    src: '/mission-photos/athena.webp',
    width: 1200,
    height: 750,
    alt: 'Athena lander on its side in a crater, Earth in the background',
    credit: 'Intuitive Machines',
    source: 'https://www.nasa.gov/?p=831743',
  },
};

export const MISSION_PHOTO_URLS = Object.values(MISSION_PHOTOS).map((p) => p.src);
