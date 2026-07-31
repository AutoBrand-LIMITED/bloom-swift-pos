import { loadGooglePlacesLibrary } from "@/lib/google-maps";
import {
  composeGooglePlaceAddress,
  publicGoogleAddressQuery,
} from "@/lib/google-address";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface GoogleAddressSuggestion {
  label: string;
  mainText: string;
  placeName: string;
  secondaryText: string;
  prediction: google.maps.places.PlacePrediction;
}

type SuggestionStatus = "idle" | "loading" | "ready" | "empty" | "unavailable";

interface UseGoogleAddressSuggestionsOptions {
  value: string;
  region: string;
  district: string;
  area: string;
  enabled?: boolean;
  onAddressSelect: (formattedAddress: string) => void;
}

const DEBOUNCE_MS = 250;

export const useGoogleAddressSuggestions = ({
  value,
  region,
  district,
  area,
  enabled = true,
  onAddressSelect,
}: UseGoogleAddressSuggestionsOptions) => {
  const [suggestions, setSuggestions] = useState<GoogleAddressSuggestion[]>([]);
  const [status, setStatus] = useState<SuggestionStatus>("idle");
  const [refreshRevision, setRefreshRevision] = useState(0);
  const mountedRef = useRef(true);
  const requestSequenceRef = useRef(0);
  const selectionSequenceRef = useRef(0);
  const previousAddressSignatureRef = useRef(
    JSON.stringify([region, district, area, value]),
  );
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken>();
  const onAddressSelectRef = useRef(onAddressSelect);

  useEffect(() => {
    onAddressSelectRef.current = onAddressSelect;
  }, [onAddressSelect]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
      selectionSequenceRef.current += 1;
    };
  }, []);

  useLayoutEffect(() => {
    const signature = JSON.stringify([region, district, area, value]);
    if (previousAddressSignatureRef.current === signature) return;
    previousAddressSignatureRef.current = signature;
    selectionSequenceRef.current += 1;
  }, [area, district, region, value]);

  const clearSuggestions = useCallback((abandonSession = false) => {
    requestSequenceRef.current += 1;
    setSuggestions([]);
    setStatus("idle");
    if (abandonSession) sessionTokenRef.current = undefined;
  }, []);

  const refreshSuggestions = useCallback(() => {
    if (value.trim()) setRefreshRevision((revision) => revision + 1);
  }, [value]);

  useEffect(() => {
    const typedDetail = value.trim();
    const queryDetail = publicGoogleAddressQuery(typedDetail);
    if (!enabled || !queryDetail) {
      clearSuggestions(Boolean(!typedDetail || !queryDetail));
      return;
    }

    const requestId = ++requestSequenceRef.current;
    setSuggestions([]);
    setStatus("loading");

    const timer = window.setTimeout(() => {
      void loadGooglePlacesLibrary()
        .then(async ({ AutocompleteSessionToken, AutocompleteSuggestion }) => {
          if (!mountedRef.current || requestId !== requestSequenceRef.current) return;
          sessionTokenRef.current ??= new AutocompleteSessionToken();

          const input = [region, district, area, queryDetail]
            .filter(Boolean)
            .join(" ");
          const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input,
            includedRegionCodes: ["hk"],
            language: "zh-HK",
            region: "HK",
            sessionToken: sessionTokenRef.current,
          });

          if (!mountedRef.current || requestId !== requestSequenceRef.current) return;
          const nextSuggestions = response.suggestions.flatMap((suggestion) => {
            const prediction = suggestion.placePrediction;
            if (!prediction) return [];
            const label = prediction.text.toString();
            const placeName = prediction.mainText?.toString() || "";
            return [{
              prediction,
              label,
              mainText: placeName || label,
              placeName,
              secondaryText: prediction.secondaryText?.toString() || "",
            }];
          });
          setSuggestions(nextSuggestions);
          setStatus(nextSuggestions.length > 0 ? "ready" : "empty");
        })
        .catch(() => {
          if (!mountedRef.current || requestId !== requestSequenceRef.current) return;
          setSuggestions([]);
          setStatus("unavailable");
        });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [
    area,
    clearSuggestions,
    district,
    enabled,
    refreshRevision,
    region,
    value,
  ]);

  const selectSuggestion = useCallback(async (suggestion: GoogleAddressSuggestion) => {
    requestSequenceRef.current += 1;
    const selectionId = ++selectionSequenceRef.current;
    setSuggestions([]);
    setStatus("loading");

    try {
      const place = suggestion.prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress"] });
      if (!mountedRef.current || selectionId !== selectionSequenceRef.current) return;
      const formattedAddress = place.formattedAddress?.trim();
      if (!formattedAddress) {
        setStatus("unavailable");
        return;
      }

      sessionTokenRef.current = undefined;
      setStatus("idle");
      onAddressSelectRef.current(
        composeGooglePlaceAddress(suggestion.placeName, formattedAddress),
      );
    } catch {
      if (!mountedRef.current || selectionId !== selectionSequenceRef.current) return;
      setStatus("unavailable");
    }
  }, []);

  return {
    suggestions,
    status,
    clearSuggestions,
    refreshSuggestions,
    selectSuggestion,
  };
};
