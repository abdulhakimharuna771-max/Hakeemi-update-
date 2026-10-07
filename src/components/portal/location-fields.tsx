'use client';

import { useEffect, useState } from 'react';

import { FieldInput, FieldSelect } from '@/components/ui/form-controls';
import { loadChildLocations } from '@/app/portal/location-actions';
import type { LocationOption } from '@/lib/types';

/**
 * State → Local Government Area → Ward cascade.
 *
 * Only the 37 states are rendered up front; each lower level is fetched from
 * the database when its parent changes, so the browser never downloads the full
 * geography tree.
 *
 * Results are stored alongside the parent id they belong to, which means a
 * stale list can never be shown for a newly selected parent — the mismatch is
 * detected during render instead of being cleared by an effect. The database
 * re-checks the state/LGA/ward hierarchy on save as well.
 */
export interface LocationValue {
  stateId: number | null;
  lgaId: number | null;
  wardId: number | null;
}

/** Display names for the current selection, reported alongside the ids. */
export interface LocationNames {
  state?: string;
  lga?: string;
  ward?: string;
}

interface OptionsFor<TParent extends number> {
  parent: TParent;
  options: LocationOption[];
}

export function LocationFields({
  states,
  value,
  onChange,
  errors,
  community,
  disabled = false,
  showWard = true,
  idPrefix = 'location',
  namePrefix = '',
  lgaRequired = true,
}: {
  states: LocationOption[];
  value: LocationValue;
  /** Receives the new ids and the display names for the level that changed. */
  onChange: (next: LocationValue, names: LocationNames) => void;
  errors?: Record<string, string>;
  /** Initial value for the free-text community input (uncontrolled). */
  community?: string | null;
  disabled?: boolean;
  showWard?: boolean;
  idPrefix?: string;
  /** Prefix for the form field names, e.g. "profile_" → "profile_state_id". */
  namePrefix?: string;
  lgaRequired?: boolean;
}) {
  const { stateId, lgaId, wardId } = value;

  const [lgaResult, setLgaResult] = useState<OptionsFor<number> | null>(null);
  const [wardResult, setWardResult] = useState<OptionsFor<number> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!stateId) return;
    let cancelled = false;

    loadChildLocations(stateId)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setLgaResult({ parent: stateId, options: [] });
          setLoadError(result.error);
          return;
        }
        setLgaResult({ parent: stateId, options: result.options });
        setLoadError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setLgaResult({ parent: stateId, options: [] });
        setLoadError('Local government areas could not be loaded. Please try again.');
      });

    return () => {
      cancelled = true;
    };
  }, [stateId, reloadToken]);

  useEffect(() => {
    if (!lgaId || !showWard) return;
    let cancelled = false;

    loadChildLocations(lgaId)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setWardResult({ parent: lgaId, options: [] });
          setLoadError(result.error);
          return;
        }
        setWardResult({ parent: lgaId, options: result.options });
      })
      .catch(() => {
        if (cancelled) return;
        setWardResult({ parent: lgaId, options: [] });
        setLoadError('Wards could not be loaded. Please try again.');
      });

    return () => {
      cancelled = true;
    };
  }, [lgaId, showWard, reloadToken]);

  // A result only applies when it belongs to the currently selected parent.
  const lgas = stateId && lgaResult?.parent === stateId ? lgaResult.options : [];
  const wards = lgaId && wardResult?.parent === lgaId ? wardResult.options : [];

  const nameFor = (options: LocationOption[], id: number | null) =>
    id === null ? undefined : options.find((option) => option.id === id)?.name;

  const lgaPending = Boolean(stateId) && lgaResult?.parent !== stateId;
  const wardPending = Boolean(lgaId) && showWard && wardResult?.parent !== lgaId;
  const noStates = states.length === 0;

  return (
    <div className="space-y-4">
      {loadError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5"
        >
          <p className="text-sm text-amber-900">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoadError(null);
              setReloadToken((token) => token + 1);
            }}
            className="text-sm font-semibold text-amber-900 underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldSelect
          id={`${idPrefix}-state`}
          name={`${namePrefix}state_id`}
          label="State"
          required={!noStates}
          disabled={disabled || noStates}
          value={stateId ? String(stateId) : ''}
          onChange={(event) => {
            const nextStateId = event.target.value ? Number(event.target.value) : null;
            onChange(
              { stateId: nextStateId, lgaId: null, wardId: null },
              { state: nameFor(states, nextStateId) }
            );
          }}
          error={errors?.state_id}
          hint={noStates ? 'The state list is not available yet.' : undefined}
        >
          <option value="">{noStates ? 'Unavailable' : 'Select a state'}</option>
          {states.map((state) => (
            <option key={state.id} value={String(state.id)}>
              {state.name}
            </option>
          ))}
        </FieldSelect>

        <FieldSelect
          id={`${idPrefix}-lga`}
          name={`${namePrefix}lga_id`}
          label="Local government area"
          required={lgaRequired && !noStates}
          optionalLabel={lgaRequired ? undefined : 'optional'}
          disabled={disabled || !stateId || lgaPending}
          value={lgaId ? String(lgaId) : ''}
          onChange={(event) => {
            const nextLgaId = event.target.value ? Number(event.target.value) : null;
            onChange(
              { stateId, lgaId: nextLgaId, wardId: null },
              { state: nameFor(states, stateId), lga: nameFor(lgas, nextLgaId) }
            );
          }}
          error={errors?.lga_id}
          hint={lgaPending ? 'Loading local government areas…' : undefined}
        >
          <option value="">
            {!stateId ? 'Select a state first' : lgaPending ? 'Loading…' : 'Select an LGA'}
          </option>
          {lgas.map((lga) => (
            <option key={lga.id} value={String(lga.id)}>
              {lga.name}
            </option>
          ))}
        </FieldSelect>
      </div>

      {showWard ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSelect
            id={`${idPrefix}-ward`}
            name={`${namePrefix}ward_id`}
            label="Ward"
            required={!noStates && lgaRequired}
            optionalLabel={lgaRequired && !noStates ? undefined : 'optional'}
            disabled={disabled || !lgaId || wardPending}
            value={wardId ? String(wardId) : ''}
            onChange={(event) => {
              const nextWardId = event.target.value ? Number(event.target.value) : null;
              onChange(
                { stateId, lgaId, wardId: nextWardId },
                {
                  state: nameFor(states, stateId),
                  lga: nameFor(lgas, lgaId),
                  ward: nameFor(wards, nextWardId),
                }
              );
            }}
            error={errors?.ward_id}
            hint={wardPending ? 'Loading wards…' : 'Choose the ward your work or community sits in.'}
          >
            <option value="">{!lgaId ? 'Select an LGA first' : wardPending ? 'Loading…' : 'Select a ward'}</option>
            {wards.map((ward) => (
              <option key={ward.id} value={String(ward.id)}>
                {ward.name}
              </option>
            ))}
          </FieldSelect>

          <FieldInput
            id={`${idPrefix}-community`}
            name={`${namePrefix}community`}
            label="Community or town"
            optionalLabel="optional"
            defaultValue={community ?? ''}
            disabled={disabled}
            error={errors?.community}
            hint="The town, village or area you are based in."
          />
        </div>
      ) : null}
    </div>
  );
}
