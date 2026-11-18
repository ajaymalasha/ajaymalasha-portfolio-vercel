import { App } from "@/components/app/App";
import { SiteView } from "@/components/site/SiteView";

/**
 * One page. The site's content is rendered on the server, so it is in the HTML for search
 * engines and for anyone without JavaScript; the app shell then decides what goes on top of it
 * (the entry screen) or in place of it (the 3D story).
 */
export default function Page() {
  return <App site={<SiteView />} />;
}
