import { useCallback, useEffect, useState } from 'react';
import { Loader } from './loader/Loader';
import { useLoadSequence, type SceneStatus } from './loader/useLoadSequence';
import { installMotionControllers } from './lib/controllers';
import { Opening } from './opening/Opening';
import { SiteHeader } from './opening/SiteHeader';
import { About, Contact, DetailsProvider, Experience, WorkSequence } from './sections';

export default function App() {
  const [scene, setScene] = useState<SceneStatus>('pending');
  const onSceneReady = useCallback(() => setScene('ready'), []);
  const onSceneFallback = useCallback(() => setScene('fallback'), []);
  const onSceneFail = useCallback(() => setScene('failed'), []);
  const sequence = useLoadSequence(scene);

  useEffect(() => installMotionControllers(), []);

  return (
    <>
      <a className="skip-link" href="#work">
        Skip to work
      </a>
      <span id="top" className="visually-hidden" aria-hidden="true" />
      <SiteHeader />
      <main id="main">
        <Opening
          scene={{ status: scene, onReady: onSceneReady, onFallback: onSceneFallback, onFail: onSceneFail }}
        />
        <DetailsProvider>
          <WorkSequence />
          <Experience />
          <About />
          <Contact />
        </DetailsProvider>
      </main>
      <Loader sequence={sequence} />
    </>
  );
}
