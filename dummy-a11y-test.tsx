import React from "react";

export default function DummyA11yTest() {
  return (
    <div>
      <img src="/logo.png" />
      <button></button>
      <input type="text" placeholder="Enter name" />
      <a href="#">Click here</a>
      <div onClick={() => alert("clicked")}>Open modal</div>
    </div>
  );
}
