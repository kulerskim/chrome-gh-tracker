// Saves options to localStorage.
function save_options() {
  localStorage["token"] = document.getElementById("token").value;

  // Update status to let user know options were saved.
  var status = document.getElementById("status");
  status.innerHTML = "Options Saved.";
  status.style.visibility='visible';
  setTimeout(function() {
    status.innerHTML = "";
    status.style.visibility='hidden';
  }, 750);
}

// Restores select box state to saved value from localStorage.
function restore_options() {
  var token = localStorage["token"];
  if (!token) {
    return;
  }
  
  document.getElementById("token").value=token
}

document.addEventListener('DOMContentLoaded', restore_options);
document.querySelector('#save').addEventListener('click', save_options);