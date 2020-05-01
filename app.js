/*

1. Map load
2. Parking locations load
3. User gives access to location
4. User's coordinates as input to search
5. Based on which find nearby parking spots

*/ 

/* This will let you use the .remove() function later on */
if (!('remove' in Element.prototype)) {
    Element.prototype.remove = function() {
      if (this.parentNode) {
          this.parentNode.removeChild(this);
      }
    };
  }

  mapboxgl.accessToken = 'pk.eyJ1IjoicHVzaGthci1kamFuZ28tbWFwcyIsImEiOiJjazNlMWhtNG0xYjV1M2RzMTBlM2Rnd2dkIn0.l8Q-dN41hMAKJfZ3MhqL-g';

  // Add map
  var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/pushkar-django-maps/ck3jout680jo21co1rwmyxjji',
    center: [74.224403, 16.694169],
    zoom: 13.7
  });

  //Create a new MapboxGeocoder instance.
  var geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    marker: true,
    proximity: {
      longitude: 74.224403,
      latitude: 16.694169
    }
  });

  // create marker
  var marker = new mapboxgl.Marker({
    'color': '#314ccd'
  });

  
  // Locate user.
  function getUserLocation(){
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(showPosition);
    } else {
      console.log("Geolocation is not supported by this browser.");
    }
  }

  var lat = null;
  var lng = null;
  var latlng = [];
  function showPosition(position) {
    user_coordinates = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
    lat = user_coordinates.lat; 
    lng = user_coordinates.lng;
    latlng = [lng,lat];
    console.log('User location : ',latlng);
    marker.setLngLat(latlng).addTo(map)
    coordinateFeature(lng, lat);
  }

  function coordinateFeature(lng, lat) {
    return {
      center: [lng, lat],
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      place_name: 'Lat: ' + lat + ' Lng: ' + lng,
      place_type: ['coordinate'],
      properties: {},
      type: 'Feature'
    };
  }
  
  // reverse geocoding
  // global scope
  var feature = null;
  let featurePlaceName = null;
  const geocodeSearch = document.getElementsByClassName('mapboxgl-ctrl-geocoder--input');

  var mapboxClient = mapboxSdk({ accessToken: mapboxgl.accessToken });

  mapboxClient.geocoding.reverseGeocode({
      query: [lng, lat]
  }).send().then(response => {
    if (response && response.body && response.body.features && response.body.features.length) {
      feature = response.body.features[0];

      // successfully getting response back
      console.log(feature);
      
      console.log(featurePlaceName = feature.place_name); 
      console.log(geocodeSearch.value = feature.place_name);
    }
  });

  var stores = {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": [
            74.224403, 
            16.694169
          ]
        },
        "properties": {
          "phoneFormatted": "(202) 234-7336",
          "phone": "2022347336",
          "address": "Parking 1",
          "city": "Parking site 1",
          "country": "India",
          "crossStreet": "at 15th St NW",
          "postalCode": "20005",
          "state": "Maharashtra"
        }
      }]
    };

  // Adding an unique ID property to 'stores'
  stores.features.forEach(function(store, i){
    store.properties.id = i;
  });

  // load map
  map.on('load', function (e) {
    map.addSource("places", {
      "type": "geojson",
      "data": stores
    });

    // Geocoder (Search) placement
    buildLocationList(stores);
    map.addControl(geocoder, 'top-left');    
    addMarkers();    

    /**
     * Listen for when a geocoder result is returned. When one is returned:
     * - Calculate distances
     * - Sort stores by distance
     * - Rebuild the listings
     * - Adjust the map camera
     * - Open a popup for the closest store
     * - Highlight the listing for the closest store.
    */
    geocoder.on('focus', function(ev) {

      /* Get the coordinate of the search result */
      var searchResult = latlng;
      console.log(searchResult);

      /**
       * Calculate distances:
       * For each store, use turf.disance to calculate the distance
       * in miles between the searchResult and the store. Assign the
       * calculated value to a property called `distance`.
      */
      var options = { units: 'kilometers' };
      stores.features.forEach(function(store){
        Object.defineProperty(store.properties, 'distance', {
          value: turf.distance(searchResult, store.geometry, options),
          writable: true,
          enumerable: true,
          configurable: true
        });
      });

      /**
       * Sort stores by distance from closest to the `searchResult`
       * to furthest.
      */
      stores.features.sort(function(a,b){
        if (a.properties.distance > b.properties.distance) {
          return 1;
        }
        if (a.properties.distance < b.properties.distance) {
          return -1;
        }
        return 0; // a must be equal to b
      });

      /**
       * Rebuild the listings:
       * Remove the existing listings and build the location
       * list again using the newly sorted stores.
      */
      var listings = document.getElementById('listings');
      while (listings.firstChild) {
        listings.removeChild(listings.firstChild);
      }
      buildLocationList(stores);

      /* Open a popup for the closest store. */
      createPopUp(stores.features[0]);

      /** Highlight the listing for the closest store. */
      var activeListing = document.getElementById('listing-' + stores.features[0].properties.id);
      activeListing.classList.add('active');

      /**
       * Adjust the map camera:
       * Get a bbox that contains both the geocoder result and
       * the closest store. Fit the bounds to that bbox.
      */
      var bbox = getBbox(stores, 0, searchResult);
      map.fitBounds(bbox, {
        padding: 100
      });
    });
  });

  /**
   * Using the coordinates (lng, lat) for
   * (1) the search result and
   * (2) the closest store
   * construct a bbox that will contain both points
  */
  function getBbox(sortedStores, storeIdentifier, searchResult) {
    var lats = [sortedStores.features[storeIdentifier].geometry.coordinates[1], searchResult.coordinates[1]]
    var lons = [sortedStores.features[storeIdentifier].geometry.coordinates[0], searchResult.coordinates[0]]
    var sortedLons = lons.sort(function(a,b){
        if (a > b) { return 1; }
        if (a.distance < b.distance) { return -1; }
        return 0;
      });
    var sortedLats = lats.sort(function(a,b){
        if (a > b) { return 1; }
        if (a.distance < b.distance) { return -1; }
        return 0;
      });
    return [
      [sortedLons[0], sortedLats[0]],
      [sortedLons[1], sortedLats[1]]
    ];
  }

  // Add marker to listing
  function addMarkers() {
    /* For each feature in the GeoJSON object above: */
    stores.features.forEach(function(marker) {
      /* Create a div element for the marker. */
      var el = document.createElement('div');
      /* Assign a unique `id` to the marker. */
      el.id = "marker-" + marker.properties.id;
      /* Assign the `marker` class to each marker for styling. */
      el.className = 'marker';

      // Create marker
      new mapboxgl.Marker(el, {offset: [0, -23]})
      .setLngLat(marker.geometry.coordinates)
      .addTo(map);

      /**
       * Listen to the element and when it is clicked, do three things:
       * 1. Fly to the point
       * 2. Close all other popups and display popup for clicked store
       * 3. Highlight listing in sidebar (and remove highlight for all other listings)
      **/
      el.addEventListener('click', function(e){
        flyToStore(marker);
        createPopUp(marker);
        var activeItem = document.getElementsByClassName('active');
        e.stopPropagation();
        if (activeItem[0]) {
          activeItem[0].classList.remove('active');
        }
        var listing = document.getElementById('listing-' + marker.properties.id);
        listing.classList.add('active');
      });
    });
  }

  /**
   * Add a listing for each store to the sidebar.
  **/
  function buildLocationList(data) {
    data.features.forEach(function(store, i){
      /**
       * Create a shortcut for `store.properties`,
       * which will be used several times below.
      **/
      var prop = store.properties;

      /* Add a new listing section to the sidebar. */
      var listings = document.getElementById('listings');
      var listing = listings.appendChild(document.createElement('div'));
      /* Assign a unique `id` to the listing. */
      listing.id = "listing-" + prop.id;
      /* Assign the `item` class to each listing for styling. */
      listing.className = 'item';

      /* Add the link to the individual listing created above. */
      var link = listing.appendChild(document.createElement('a'));
      link.href = '#';
      link.className = 'title';
      link.id = "link-" + prop.id;
      link.innerHTML = prop.address;

      /* Add details to the individual listing. */
      var details = listing.appendChild(document.createElement('div'));
      details.innerHTML = prop.city;
      if (prop.phone) {
        details.innerHTML += ' · ' + prop.phoneFormatted;
      }
      if (prop.distance) {
        var roundedDistance = Math.round(prop.distance*100)/100;
        roundedDistance *= 1.61;
        details.innerHTML += '<p><strong>' + roundedDistance + ' km away</strong></p>';
      }

      /**
       * Listen to the element and when it is clicked, do four things:
       * 1. Update the `currentFeature` to the store associated with the clicked link
       * 2. Fly to the point
       * 3. Close all other popups and display popup for clicked store
       * 4. Highlight listing in sidebar (and remove highlight for all other listings)
      **/
      link.addEventListener('click', function(e){
        for (var i=0; i < data.features.length; i++) {
          if (this.id === "link-" + data.features[i].properties.id) {
            var clickedListing = data.features[i];
            flyToStore(clickedListing);
            createPopUp(clickedListing);
          }
        }
        var activeItem = document.getElementsByClassName('active');
        if (activeItem[0]) {
          activeItem[0].classList.remove('active');
        }
        this.parentNode.classList.add('active');
      });
    });
  }

  // flyTo function
  function flyToStore(currentFeature) {
    map.flyTo({
        center: currentFeature.geometry.coordinates,
        zoom: 15
      });
  }

  // Popup
  function createPopUp(currentFeature) {
    var popUps = document.getElementsByClassName('mapboxgl-popup');
    if (popUps[0]) popUps[0].remove();

    var popup = new mapboxgl.Popup({closeOnClick: false})
      .setLngLat(currentFeature.geometry.coordinates)
      .setHTML('<h3>Parking</h3>' +
        '<h4>' + currentFeature.properties.address + '</h4>')
      .addTo(map);
  }