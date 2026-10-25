const VISITOR_ACCESS_KEY = "globalristey_visitor_access";

if (!window.localStorage.getItem(VISITOR_ACCESS_KEY)) {
  window.location.replace("./signup.html?return=search");
}
