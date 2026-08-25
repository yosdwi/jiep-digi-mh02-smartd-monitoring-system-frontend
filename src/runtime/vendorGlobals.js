import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { PathLayer, ScatterplotLayer, IconLayer, TextLayer } from "@deck.gl/layers";
import { DataFilterExtension } from "@deck.gl/extensions";
import * as agGrid from "ag-grid-community";
import * as XLSX from "xlsx";
import JSZip from "jszip";

export function installVendorGlobals() {
  globalThis.maplibregl = maplibregl;
  globalThis.deck = {
    MapboxOverlay, PathLayer, ScatterplotLayer, IconLayer, TextLayer, DataFilterExtension,
  };
  globalThis.agGrid = agGrid;
  globalThis.XLSX = XLSX;
  globalThis.JSZip = JSZip;
}
