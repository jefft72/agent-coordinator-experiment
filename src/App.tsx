import { useCallback, useEffect, useState } from 'react';
import { Loader } from './loader/Loader';
import { useLoadSequence, type SceneStatus } from './loader/useLoadSequence';
import { installMotionControllers } from './lib/controllers';
import { installZoneTracker } from './lib/zones';
import { useInitialFragment } from './lib/useInitialFragment';
import { Opening } from './opening/Opening';
import { SceneHost } from './opening/SceneHost';
import { SiteHeader } from './opening/SiteHeader';
import { About } from './chapters/About';
import { Experience } from './chapters/Experience';
import { Hackathons } from './chapters/Hackathons';
import { Ventures } from './chapters/Ventures';

export default function App() {
  const [scene, setScene] = useState<SceneStatus>('pending');
  const onSceneReady = useCallback(() => setScene('ready'), []);
  const onSceneFallback = useCallback(() => setScene('fallback'), []);
  const onSceneFail = useCallback(() => setScene('failed'), []);
  const sequence = useLoadSequence(scene);

  useEffect(() => installMotionControllers(), []);
  useEffect(() => installZoneTracker(), []);
  useInitialFragment(sequence.state);

  return (
    <>
      <a className="skip-link" href="#hackathons">
        Skip to the work
      </a>
      <span id="top" className="visually-hidden" aria-hidden="true" />
      <SceneHost status={scene} onReady={onSceneReady} onFallback={onSceneFallback} onFail={onSceneFail} />
      <SiteHeader />
      <main id="main" className="page">
        <Opening />
        <Hackathons />
        <Experience />
        <Ventures />
        <About />
      </main>
      <Loader sequence={sequence} />
    </>
  );
}
