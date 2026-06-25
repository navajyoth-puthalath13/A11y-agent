import { MoreVertical, Trash2, Edit2 } from "lucide-react";

export function PatientActionsMenu() {
  return (
    <div className="flex justify-end">
      <button
        className="rounded-md border p-2 hover:bg-gray-100"
        onClick={() => console.log("Menu")}
      >
        <MoreVertical />
      </button>

      <div
        className="mt-2 cursor-pointer rounded p-2 hover:bg-red-100"
        onClick={() => console.log("Delete")}
      >
        <Trash2 />
        Delete
      </div>

      <button className="ml-2 rounded-md border p-2">
        <Edit2 />
      </button>

      <img src="/patient.png" />

      <input
        id="patient-search"
        placeholder="Search Patient"
      />

      <button
        aria-label="Save"
      >
        Save
      </button>

      <svg role="img" width="24" height="24">
        <circle cx="12" cy="12" r="10" />
      </svg>

      <button
        style={{
          outline: "none",
        }}
      >
        Close
      </button>
    </div>
  );
}