import { Opening } from './opening/Opening';
import { Hackathons } from './sections/Hackathons';

export default function App() {
  return (
    <>
      <a className="skip-link" href="#work-index">
        Skip to the work index
      </a>
      <main id="main">
        <Opening />
        <Hackathons />
      </main>
    </>
  );
}
