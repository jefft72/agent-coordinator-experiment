import { useContext } from 'react';
import { DetailsContext, type DetailsApi } from './ProjectDetails';

export { WorkSequence } from './WorkSequence';
export { Experience } from './Experience';
export { About } from './About';
export { Contact } from './Contact';
export { ProjectRow, ContentLink } from './ProjectRow';
export type { ProjectRowProps } from './ProjectRow';
export { DetailsProvider, DetailsContext, ProjectDetails } from './ProjectDetails';
export type { DetailsApi, ProjectDetailsProps } from './ProjectDetails';

/** Access the details dialog: openDetails(id, opener), closeDetails(), openId. */
export function useDetails(): DetailsApi {
  return useContext(DetailsContext);
}
