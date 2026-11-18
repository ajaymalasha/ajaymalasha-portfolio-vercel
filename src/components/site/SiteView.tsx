import { common } from "@/content/sections";
import { ChapterIndicator } from "./chrome/ChapterIndicator";
import { FloatingMenu } from "./chrome/FloatingMenu";
import { ScrollProgress } from "./chrome/ScrollProgress";
import { About } from "./sections/About";
import { Building } from "./sections/Building";
import { ContactBrief } from "./sections/ContactBrief";
import { Experience } from "./sections/Experience";
import { Footer } from "./sections/Footer";
import { Hero } from "./sections/Hero";
import { Method } from "./sections/Method";
import { Motto } from "./sections/Motto";
import { NavBar } from "./sections/NavBar";
import { OffClock } from "./sections/OffClock";
import { Services } from "./sections/Services";
import { Work } from "./sections/Work";
import { SiteFx } from "./SiteFx";
import styles from "./SiteView.module.css";

/**
 * The site: one long page. Each section declares the theme the page takes while it is on screen
 * (`data-theme`) and the label shown in the corner (`data-chapter`); SiteFx reads both, and also
 * mounts everything drawn in canvas behind and over the page.
 */
export function SiteView() {
  return (
    <div className={styles.site} data-view="site">
      <a href="#main" className="skip-link font-regular">
        {common.skip}
      </a>
      <SiteFx />
      <ScrollProgress />
      <NavBar />
      <FloatingMenu />
      <ChapterIndicator />
      <main id="main">
        <Hero />
        <About />
        <Services />
        <Work />
        <Building />
        <Experience />
        <Motto />
        <Method />
        <OffClock />
        <ContactBrief />
      </main>
      <Footer />
    </div>
  );
}
