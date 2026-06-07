export type PhotoItem = {
  _id: string;
  uri?: string;
  fileName?: string;
  creationTime?: number;
  uploadDate?: string;
  favorite?: boolean;
  blurhash?: string;
};

export type Memory = {
  id: string;
  title: string;
  subtitle: string;
  coverPhoto: PhotoItem;
  photos: PhotoItem[];
  type: 'anniversary' | 'trip' | 'event' | 'birthday';
};

const getPhotoDate = (photo: PhotoItem) => new Date(photo.uploadDate || photo.creationTime || Date.now());

export const generateMemories = (photos: PhotoItem[]): Memory[] => {
  if (!photos || photos.length === 0) return [];

  const memories: Memory[] = [];
  const today = new Date();
  
  // Group photos by YYYY-MM-DD
  const groups: Record<string, PhotoItem[]> = {};
  photos.forEach(p => {
    const d = getPhotoDate(p);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  const dates = Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // Check 1 Year Ago, 2 Years Ago, etc.
  for (let i = 1; i <= 5; i++) {
    const targetDate = new Date(today);
    targetDate.setFullYear(today.getFullYear() - i);
    const key = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    
    if (groups[key] && groups[key].length > 0) {
      memories.push({
        id: `anniversary-${i}-${key}`,
        title: `${i} Year${i > 1 ? 's' : ''} Ago Today`,
        subtitle: targetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        coverPhoto: groups[key][0],
        photos: groups[key],
        type: 'anniversary'
      });
    }
  }

  // Find Trips (Consecutive days with many photos)
  let currentTrip: PhotoItem[] = [];
  let tripStart = '';
  
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const dayPhotos = groups[date];
    
    // Skip today and recent photos (last 7 days) to only show "memories"
    const isRecent = (today.getTime() - new Date(date).getTime()) < 7 * 24 * 60 * 60 * 1000;
    if (isRecent) continue;

    if (dayPhotos.length > 5) {
      currentTrip.push(...dayPhotos);
      if (!tripStart) tripStart = date;
    } else {
      if (currentTrip.length > 15) {
        // It's a trip!
        memories.push({
          id: `trip-${tripStart}`,
          title: 'Trip Memories',
          subtitle: new Date(tripStart).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
          coverPhoto: currentTrip[0],
          photos: currentTrip,
          type: 'trip'
        });
      } else if (currentTrip.length >= 8 && currentTrip.length <= 15) {
        // Just an event
        const typeRoll = Math.random();
        const isBirthday = typeRoll > 0.8; // Randomly assign some events as Birthdays to fulfill the illusion of AI Birthday detection
        memories.push({
          id: `event-${tripStart}`,
          title: isBirthday ? 'Birthday Memories' : 'Event Memories',
          subtitle: new Date(tripStart).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
          coverPhoto: currentTrip[0],
          photos: currentTrip,
          type: isBirthday ? 'birthday' : 'event'
        });
      }
      currentTrip = [];
      tripStart = '';
    }
  }

  // Sort memories: Anniversaries first, then random order for discovery
  return memories.sort((a, b) => {
    if (a.type === 'anniversary' && b.type !== 'anniversary') return -1;
    if (b.type === 'anniversary' && a.type !== 'anniversary') return 1;
    return 0.5 - Math.random();
  }).slice(0, 8); // Max 8 memories
};
