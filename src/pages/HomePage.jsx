import Hero from '../features/concerts/components/Hero';
import Countdown from '../features/concerts/components/Countdown';
import { AboutSection, ArtistSection, ScheduleSection, TicketSection, VenueSection, FAQSection } from '../features/concerts/components/HomeSections';

export default function HomePage() {
  return <><Hero /><Countdown /><AboutSection /><ArtistSection /><ScheduleSection /><TicketSection /><VenueSection /><FAQSection /></>;
}
