const mapsApi = window.googleMapsDesktop;

const backButton = document.getElementById('backButton');
const forwardButton = document.getElementById('forwardButton');
const refreshButton = document.getElementById('refreshButton');
const homeButton = document.getElementById('homeButton');
const statusText = document.getElementById('statusText');

function setStatus(text) {
  statusText.textContent = text;
}

function updateNavigationState(state) {
  backButton.disabled = !state.canGoBack;
  forwardButton.disabled = !state.canGoForward;
}

backButton.addEventListener('click', () => {
  mapsApi.back();
});

forwardButton.addEventListener('click', () => {
  mapsApi.forward();
});

refreshButton.addEventListener('click', () => {
  mapsApi.refresh();
});

homeButton.addEventListener('click', () => {
  mapsApi.home();
});

mapsApi.onNavigationState(updateNavigationState);
mapsApi.onStatus(setStatus);
