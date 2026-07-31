import { Label } from "@/components/ui/label";
import {
  GoogleMapsUnavailableError,
  hasUsableGoogleMapsApiKey,
  loadGooglePlacesLibrary,
} from "@/lib/google-maps";
import { LoaderCircle, MapPinned } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface GooglePlaceAutocompleteProps {
  onAddressSelect: (formattedAddress: string) => void;
  resetRevision: number;
}

type WidgetStatus = "loading" | "ready" | "unavailable";

const GooglePlaceAutocomplete = ({
  onAddressSelect,
  resetRevision,
}: GooglePlaceAutocompleteProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const onAddressSelectRef = useRef(onAddressSelect);
  const [status, setStatus] = useState<WidgetStatus>(
    hasUsableGoogleMapsApiKey() ? "loading" : "unavailable",
  );

  useEffect(() => {
    onAddressSelectRef.current = onAddressSelect;
  }, [onAddressSelect]);

  useEffect(() => {
    if (!hasUsableGoogleMapsApiKey()) {
      setStatus("unavailable");
      return;
    }

    setStatus("loading");
    const host = hostRef.current;
    if (!host) {
      setStatus("unavailable");
      return;
    }

    let active = true;
    let selectionSequence = 0;
    let autocomplete: google.maps.places.PlaceAutocompleteElement | undefined;
    let handleSelection:
      | ((event: google.maps.places.PlacePredictionSelectEvent) => Promise<void>)
      | undefined;

    const markUnavailable = () => {
      selectionSequence += 1;
      if (active) setStatus("unavailable");
    };

    void loadGooglePlacesLibrary()
      .then(({ PlaceAutocompleteElement }) => {
        if (!active) return;

        autocomplete = new PlaceAutocompleteElement({
          includedRegionCodes: ["hk"],
          requestedLanguage: "zh-HK",
          requestedRegion: "hk",
          placeholder: "輸入大廈、街道或地區搜尋 Google 地址",
          description: "Google 地址搜尋，只顯示香港建議",
          maxlength: 200,
        });
        autocomplete.className = "block min-h-11 w-full";
        autocomplete.setAttribute("aria-label", "Google 地址搜尋");

        handleSelection = async (
          event: google.maps.places.PlacePredictionSelectEvent,
        ) => {
          const currentSelection = ++selectionSequence;

          try {
            const place = event.placePrediction.toPlace();
            await place.fetchFields({ fields: ["formattedAddress"] });

            if (!active || currentSelection !== selectionSequence) return;
            const address = place.formattedAddress?.trim();
            if (!address) throw new GoogleMapsUnavailableError();

            onAddressSelectRef.current(address);
          } catch {
            markUnavailable();
          }
        };

        autocomplete.addEventListener("gmp-select", handleSelection);
        autocomplete.addEventListener("gmp-error", markUnavailable);
        host.replaceChildren(autocomplete);
        setStatus("ready");
      })
      .catch(markUnavailable);

    return () => {
      active = false;
      selectionSequence += 1;
      if (autocomplete && handleSelection) {
        autocomplete.removeEventListener("gmp-select", handleSelection);
        autocomplete.removeEventListener("gmp-error", markUnavailable);
      }
      autocomplete?.remove();
      host.replaceChildren();
    };
  }, [resetRevision]);

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1 text-xs">
        <MapPinned className="h-3.5 w-3.5" />
        Google 地址搜尋（建議）
      </Label>

      <div
        ref={hostRef}
        className={status === "ready" ? "min-h-11" : "hidden"}
        data-testid="google-place-autocomplete-host"
      />

      {status === "loading" && (
        <p
          role="status"
          className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs text-muted-foreground"
        >
          <LoaderCircle className="h-4 w-4 animate-spin" />
          正在載入 Google 地址搜尋...
        </p>
      )}

      {status === "unavailable" && (
        <p role="status" className="text-xs text-muted-foreground">
          Google 地址搜尋暫時不可用，請使用下方手動地址欄。
        </p>
      )}

      {status === "ready" && (
        <p className="text-xs text-muted-foreground">
          請從 Google 建議清單揀選地址；仍可在下方手動修改。
        </p>
      )}
    </div>
  );
};

export default GooglePlaceAutocomplete;
