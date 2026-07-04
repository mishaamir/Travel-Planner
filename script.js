/**
 * Travel Planner — Main Script
 * Handles navigation, REST Countries API search, scroll effects, and interactions.
 */

(function () {
  'use strict';

  /* ==========================================================
     Constants & DOM References
     ========================================================== */
  // REST Countries API — v3.1 endpoint (standard tutorial format)
  const API_BASE = 'https://restcountries.com/v3.1/name';

  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const searchResult = document.getElementById('searchResult');
  const searchButton = searchForm.querySelector('.btn-search');
  const destinationCards = document.querySelectorAll('.destination-card');
  const exploreButtons = document.querySelectorAll('.explore-btn');

  /* ==========================================================
     Navbar — Scroll shadow & active link tracking
     ========================================================== */

  function handleNavbarScroll() {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id], footer[id]');
    let currentSection = '';

    sections.forEach(function (section) {
      const sectionTop = section.offsetTop - 100;
      const sectionHeight = section.offsetHeight;

      if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
        currentSection = section.getAttribute('id');
      }
    });

    navLinks.forEach(function (link) {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + currentSection) {
        link.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', function () {
    handleNavbarScroll();
    updateActiveNavLink();
  });

  /* ==========================================================
     Mobile Navigation Toggle
     ========================================================== */

  navToggle.addEventListener('click', function () {
    const isOpen = navMenu.classList.toggle('open');
    navToggle.classList.toggle('active');
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  navLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      navMenu.classList.remove('open');
      navToggle.classList.remove('active');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* ==========================================================
     REST Countries API — Search
     ========================================================== */

  /**
   * Format a number with locale-aware separators.
   * @param {number} num
   * @returns {string}
   */
  function formatPopulation(num) {
    return num.toLocaleString('en-US');
  }

  /**
   * Normalize API country data into a consistent shape for rendering.
   * Supports both REST Countries v3.1 and compatible fallback responses.
   * @param {Object} country
   * @returns {Object}
   */
  function normalizeCountry(country) {
    const isV3 = country.name && country.name.common;

    if (isV3) {
      return {
        name: country.name.common,
        capital: country.capital ? country.capital[0] : 'N/A',
        region: country.region || 'N/A',
        population: country.population,
        currencies: country.currencies,
        languages: country.languages,
        flagUrl: country.flags.svg || country.flags.png,
        flagAlt: country.flags.alt || country.name.common + ' flag',
        flagEmoji: null
      };
    }

    return {
      name: country.name,
      capital: country.capital || 'N/A',
      region: country.region || 'N/A',
      population: country.population,
      currencies: country.currencies,
      languages: country.languages,
      flagUrl: country.flags ? (country.flags.svg || country.flags.png) : null,
      flagAlt: country.name + ' flag',
      flagEmoji: country.flag || null
    };
  }

  /**
   * Extract currency names from the API currencies object.
   * @param {Object|undefined} currencies
   * @returns {string}
   */
  function formatCurrencies(currencies) {
    if (!currencies) return 'N/A';

    if (Array.isArray(currencies)) {
      return currencies.map(function (c) {
        return c.name + (c.symbol ? ' (' + c.symbol + ')' : '');
      }).join(', ');
    }

    return Object.values(currencies)
      .map(function (c) {
        return c.name + (c.symbol ? ' (' + c.symbol + ')' : '');
      })
      .join(', ');
  }

  /**
   * Extract language names from the API languages array.
   * @param {Array|undefined} languages
   * @returns {string}
   */
  function formatLanguages(languages) {
    if (!languages) return 'N/A';

    if (Array.isArray(languages)) {
      return languages
        .map(function (lang) {
          return lang.name || lang;
        })
        .join(', ');
    }

    return Object.values(languages).join(', ');
  }

  /**
   * Fallback fetch when the primary REST Countries endpoint is unavailable.
   * @param {string} trimmed - Trimmed country name
   * @returns {Promise<Object|null>}
   */
  async function fetchCountryFallback(trimmed) {
    const fallbackResponse = await fetch(
      'https://countries.dev/name/' + encodeURIComponent(trimmed)
    );

    if (fallbackResponse.status === 404) {
      return null;
    }

    if (!fallbackResponse.ok) {
      throw new Error('Unable to fetch country data. Please try again.');
    }

    const fallbackData = await fallbackResponse.json();
    return fallbackData.length > 0 ? normalizeCountry(fallbackData[0]) : null;
  }

  /**
   * Fetch country data from the REST Countries API.
   * @param {string} query - Country name to search
   * @returns {Promise<Object|null>} Normalized country data or null if not found
   */
  async function fetchCountry(query) {
    const trimmed = query.trim();
    const url = API_BASE + '/' + encodeURIComponent(trimmed) +
      '?fields=name,capital,region,population,currencies,languages,flags';

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data && data.success === false) {
        return fetchCountryFallback(trimmed);
      }

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Unable to fetch country data. Please try again.');
      }

      return Array.isArray(data) && data.length > 0 ? normalizeCountry(data[0]) : null;
    } catch (error) {
      if (error.message === 'Unable to fetch country data. Please try again.') {
        throw error;
      }
      return fetchCountryFallback(trimmed);
    }
  }

  /** Show loading spinner while fetching */
  function showLoading() {
    searchResult.className = 'search-result';
    searchResult.innerHTML =
      '<div class="search-loading">' +
        '<div class="spinner" role="status" aria-label="Loading"></div>' +
        '<span>Searching for your destination...</span>' +
      '</div>';
  }

  /**
   * Render a glassmorphism country result card.
   * @param {Object} country - REST Countries API response object
   */
  function renderCountryCard(country) {
    const population = formatPopulation(country.population);
    const currency = formatCurrencies(country.currencies);
    const languages = formatLanguages(country.languages);

    searchResult.className = 'search-result';
    searchResult.innerHTML =
      '<article class="country-card">' +
        '<div class="country-card__header">' +
          (country.flagUrl
            ? '<img class="country-card__flag" src="' + country.flagUrl + '" alt="' + country.flagAlt + '">'
            : '<span class="country-card__flag-emoji" aria-hidden="true">' + (country.flagEmoji || '🏳') + '</span>') +
          '<h3 class="country-card__name">' + country.name + '</h3>' +
        '</div>' +
        '<dl class="country-card__details">' +
          '<div class="country-card__row">' +
            '<dt>Capital</dt><dd>' + country.capital + '</dd>' +
          '</div>' +
          '<div class="country-card__row">' +
            '<dt>Region</dt><dd>' + country.region + '</dd>' +
          '</div>' +
          '<div class="country-card__row">' +
            '<dt>Population</dt><dd>' + population + '</dd>' +
          '</div>' +
          '<div class="country-card__row">' +
            '<dt>Currency</dt><dd>' + currency + '</dd>' +
          '</div>' +
          '<div class="country-card__row">' +
            '<dt>Languages</dt><dd>' + languages + '</dd>' +
          '</div>' +
        '</dl>' +
      '</article>';
  }

  /**
   * Render a friendly error card when country is not found or fetch fails.
   * @param {string} message - Error message to display
   */
  function renderErrorCard(message) {
    searchResult.className = 'search-result';
    searchResult.innerHTML =
      '<div class="error-card" role="alert">' +
        '<span class="error-card__icon" aria-hidden="true">🌍</span>' +
        '<p class="error-card__message">' + message + '</p>' +
      '</div>';
  }

  /**
   * Highlight a matching destination card in the Popular Destinations section.
   * @param {string} countryName
   */
  function highlightDestination(countryName) {
    destinationCards.forEach(function (card) {
      card.classList.remove('highlight');
    });

    destinationCards.forEach(function (card) {
      const title = card.querySelector('.card-title');
      if (title && title.textContent.toLowerCase() === countryName.toLowerCase()) {
        card.classList.add('highlight');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });

        setTimeout(function () {
          card.classList.remove('highlight');
        }, 3000);
      }
    });
  }

  /** Set search button disabled state during API calls */
  function setSearchLoading(isLoading) {
    searchButton.disabled = isLoading;
    searchButton.classList.toggle('is-loading', isLoading);
  }

  /**
   * Handle country search — validates input, fetches API data, renders result.
   * @param {string} [queryOverride] - Optional query from explore buttons
   */
  async function handleSearch(queryOverride) {
    const query = (queryOverride !== undefined ? queryOverride : searchInput.value).trim();

    if (!query) {
      renderErrorCard('Please enter a country name to search.');
      return;
    }

    showLoading();
    setSearchLoading(true);

    try {
      const country = await fetchCountry(query);

      if (country) {
        renderCountryCard(country);
        highlightDestination(country.name);
      } else {
        renderErrorCard(
          'We couldn\'t find "' + query + '". Try checking the spelling or search for Japan, France, or Brazil.'
        );
      }
    } catch (error) {
      renderErrorCard(error.message || 'Something went wrong. Please check your connection and try again.');
    } finally {
      setSearchLoading(false);
    }
  }

  searchForm.addEventListener('submit', function (event) {
    event.preventDefault();
    handleSearch();
  });

  /* ==========================================================
     Travel Guide Modal — Static destination data
     ========================================================== */

  const travelModal = document.getElementById('travelModal');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');

  const travelGuides = {
    Japan: {
      name: 'Japan',
      image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=900&q=80',
      description: 'A captivating blend of ancient tradition and cutting-edge modernity. From serene temples and cherry blossoms to neon-lit cities and world-renowned cuisine, Japan offers an unforgettable cultural journey.',
      bestTime: 'March – May (cherry blossoms) & October – November (autumn foliage)',
      attractions: ['Mount Fuji', 'Fushimi Inari Shrine', 'Shibuya Crossing'],
      foods: ['Sushi & Sashimi', 'Ramen', 'Okonomiyaki'],
      budget: '$2,500 – $4,000 per week (mid-range)',
      tips: 'Purchase a JR Pass before arrival for unlimited train travel. Carry cash as many small shops don\'t accept cards. Learn basic phrases like "Arigato" (thank you) — locals appreciate the effort.',
      safety: 'Very Safe',
      safetyLevel: 'high'
    },
    Italy: {
      name: 'Italy',
      image: 'https://images.pexels.com/photos/1796730/pexels-photo-1796730.jpeg',
      description: 'The heart of art, history, and la dolce vita. Wander through Roman ruins, cruise Venetian canals, and savor authentic pasta and wine in one of the world\'s most beloved destinations.',
      bestTime: 'April – June & September – October (pleasant weather, fewer crowds)',
      attractions: ['Colosseum (Rome)', 'Canals of Venice', 'Leaning Tower of Pisa'],
      foods: ['Pizza Napoletana', 'Fresh Pasta', 'Gelato'],
      budget: '$2,000 – $3,500 per week (mid-range)',
      tips: 'Book major attractions online to skip long queues. Dress modestly when visiting churches. Enjoy the riposo — many shops close between 1–4 PM.',
      safety: 'Very Safe',
      safetyLevel: 'high'
    },
    Thailand: {
      name: 'Thailand',
      image: 'https://images.pexels.com/photos/1450353/pexels-photo-1450353.jpeg',
      description: 'The Land of Smiles enchants with golden temples, turquoise beaches, lush jungles, and some of the most flavorful street food on the planet. Perfect for both adventure seekers and relaxation lovers.',
      bestTime: 'November – February (cool, dry season)',
      attractions: ['Grand Palace (Bangkok)', 'Phi Phi Islands', 'Doi Suthep Temple (Chiang Mai)'],
      foods: ['Pad Thai', 'Tom Yum Goong', 'Mango Sticky Rice'],
      budget: '$800 – $1,500 per week (mid-range)',
      tips: 'Respect the monarchy and dress appropriately at temples (cover shoulders and knees). Stay hydrated and use mosquito repellent. Bargain politely at markets.',
      safety: 'Generally Safe',
      safetyLevel: 'high'
    },
    France: {
      name: 'France',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=900&q=80',
      description: 'From the iconic Eiffel Tower to lavender fields in Provence, France is a timeless destination of elegance, gastronomy, and rich cultural heritage that continues to inspire travelers worldwide.',
      bestTime: 'April – June & September – October (mild weather, fewer tourists)',
      attractions: ['Eiffel Tower (Paris)', 'Palace of Versailles', 'Mont Saint-Michel'],
      foods: ['Croissants & Baguettes', 'Coq au Vin', 'Crêpes'],
      budget: '$2,200 – $3,800 per week (mid-range)',
      tips: 'Greet shopkeepers with "Bonjour" before asking questions. Many restaurants close between lunch and dinner. The Paris Metro is the easiest way to get around the city.',
      safety: 'Very Safe',
      safetyLevel: 'high'
    }
  };

  /**
   * Build the HTML for a travel guide modal.
   * @param {Object} guide - Travel guide data object
   * @returns {string}
   */
  function renderTravelGuide(guide) {
    const attractionsList = guide.attractions
      .map(function (item) { return '<li>' + item + '</li>'; })
      .join('');

    const foodsList = guide.foods
      .map(function (item) { return '<li>' + item + '</li>'; })
      .join('');

    return (
      '<div class="modal__image-wrapper">' +
        '<img class="modal__image" src="' + guide.image + '" alt="' + guide.name + ' travel destination">' +
        '<div class="modal__image-overlay"></div>' +
        '<h2 class="modal__image-title" id="modalTitle">' + guide.name + '</h2>' +
      '</div>' +
      '<div class="modal__body">' +
        '<p class="modal__description">' + guide.description + '</p>' +
        '<div class="modal__grid">' +
          '<div class="modal__section">' +
            '<h3 class="modal__section-title"><span class="modal__section-icon" aria-hidden="true">📅</span> Best Time to Visit</h3>' +
            '<p class="modal__text">' + guide.bestTime + '</p>' +
          '</div>' +
          '<div class="modal__section">' +
            '<h3 class="modal__section-title"><span class="modal__section-icon" aria-hidden="true">💰</span> Estimated Budget</h3>' +
            '<p class="modal__budget">' + guide.budget + '</p>' +
          '</div>' +
          '<div class="modal__section">' +
            '<h3 class="modal__section-title"><span class="modal__section-icon" aria-hidden="true">🏛</span> Top Attractions</h3>' +
            '<ul class="modal__list">' + attractionsList + '</ul>' +
          '</div>' +
          '<div class="modal__section">' +
            '<h3 class="modal__section-title"><span class="modal__section-icon" aria-hidden="true">🍽</span> Popular Local Foods</h3>' +
            '<ul class="modal__list">' + foodsList + '</ul>' +
          '</div>' +
          '<div class="modal__section modal__section--full">' +
            '<h3 class="modal__section-title"><span class="modal__section-icon" aria-hidden="true">💡</span> Travel Tips</h3>' +
            '<p class="modal__text">' + guide.tips + '</p>' +
          '</div>' +
          '<div class="modal__section">' +
            '<h3 class="modal__section-title"><span class="modal__section-icon" aria-hidden="true">🛡</span> Safety Level</h3>' +
            '<span class="modal__safety modal__safety--' + guide.safetyLevel + '">' + guide.safety + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="modal__footer">' +
          '<button class="btn btn-modal-close" id="modalCloseBtn" type="button">Close</button>' +
        '</div>' +
      '</div>'
    );
  }

  /** Open the travel guide modal for a given country */
  function openTravelModal(country) {
    const guide = travelGuides[country];

    if (!guide) {
      return;
    }

    modalContent.innerHTML = renderTravelGuide(guide);
    travelModal.classList.add('is-open');
    travelModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    document.getElementById('modalCloseBtn').addEventListener('click', closeTravelModal);
  }

  /** Close the travel guide modal */
  function closeTravelModal() {
    travelModal.classList.remove('is-open');
    travelModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  modalOverlay.addEventListener('click', closeTravelModal);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && travelModal.classList.contains('is-open')) {
      closeTravelModal();
    }
  });

  /* ==========================================================
     Explore Button — Open Travel Guide Modal
     ========================================================== */

  exploreButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      const country = button.getAttribute('data-country');
      openTravelModal(country);
    });
  });

  /* ==========================================================
     Scroll Reveal Animation (Intersection Observer)
     ========================================================== */

  function initScrollReveal() {
    const revealElements = document.querySelectorAll(
      '.destination-card, .feature-card, .section-header'
    );

    revealElements.forEach(function (el) {
      el.classList.add('reveal');
    });

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    revealElements.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ==========================================================
     Initialize
     ========================================================== */

  function init() {
    handleNavbarScroll();
    initScrollReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
