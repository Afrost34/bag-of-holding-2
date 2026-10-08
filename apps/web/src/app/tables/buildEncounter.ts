import { useEncounters } from '../encounters/store';
import { useAppNavigate } from '../navigation';

/** Creates an encounter from creatures and opens it. */
export function useBuildEncounter(): (
  name: string,
  campaign: string | undefined,
  keys: string[],
) => void {
  const navigate = useAppNavigate();
  return (name, campaign, keys) => {
    void useEncounters
      .getState()
      .load()
      .then(() => useEncounters.getState().create(name, campaign, keys))
      .then((e) => {
        navigate(`/encounters/${e.id}`);
      });
  };
}
