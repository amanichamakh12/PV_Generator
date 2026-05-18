/**
 * Configuration API
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 30000;

/**
 * Classe pour gérer les appels API
 */
class PVAPIClient {
  /**
   * Envoyer un fichier PPTX pour parsing
   * @param {File} file - Fichier a envoyer
   * @param {Function} onProgress - Callback pour le progres
   * @returns {Promise<Object>} Resultat du parsing
   */
  static async parsePPTX(file, onProgress = null) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const xhr = new XMLHttpRequest();

      // Gérer le progrès de l'upload
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress({
              type: 'upload',
              progress: Math.round(percentComplete)
            });
          }
        });
      }

      return new Promise((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error('Reponse API invalide'));
            }
          } else {
            reject(new Error(`Erreur API: ${xhr.status} ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Erreur de connexion a l\'API'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Requete annulee'));
        });

        xhr.open('POST', `${API_BASE_URL}/parse-pptx`);
        xhr.send(formData);
      });
    } catch (error) {
      throw new Error(`Erreur lors du parsing PPTX: ${error.message}`);
    }
  }

  /**
   * Analyser les slides
   * @param {Object} parsedData - Donnees PPTX parsees
   * @returns {Promise<Object>} Resultat de l'analyse
   */
  static async analyzeSlidess(parsedData) {
    try {
      const response = await fetch(`${API_BASE_URL}/analyze-slides`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(parsedData)
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Erreur lors de l'analyse: ${error.message}`);
    }
  }

  /**
   * Synthetiser l'agenda
   * @param {Array} analyses - Analyses des slides
   * @returns {Promise<Object>} Synthese generee
   */
  static async synthesizeAgenda(analyses) {
    try {
      const response = await fetch(`${API_BASE_URL}/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ analyses })
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Erreur lors de la synthese: ${error.message}`);
    }
  }

  /**
   * Mettre a jour l'extraction
   * @param {number} id - ID du document
   * @param {Object} data - Nouvelles donnees
   * @returns {Promise<Object>} Resultat de la mise a jour
   */
  static async updateExtraction(id, data) {
    try {
      const response = await fetch(`${API_BASE_URL}/update-extraction`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id, data })
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Erreur lors de la mise a jour: ${error.message}`);
    }
  }

  /**
   * Supprimer un slide
   * @param {number} id - ID du document
   * @param {number} slideIndex - Index du slide a supprimer
   * @returns {Promise<Object>} Resultat de la suppression
   */
  static async deleteSlide(id, slideIndex) {
    try {
      const response = await fetch(`${API_BASE_URL}/delete-slide`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id, slideIndex })
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Erreur lors de la suppression: ${error.message}`);
    }
  }

  /**
   * Analyser l'agenda complet
   * @param {string} ordreduJour - Ordre du jour
   * @param {Array} slides - Slides a analyser
   * @param {boolean} useLLM - Utiliser LLM pour l'analyse
   * @returns {Promise<Object>} Resultat de l'analyse
   */
  static async analyzeAgendaFull(ordreduJour, slides, useLLM = true) {
    try {
      const response = await fetch(`${API_BASE_URL}/analyze-agenda-full`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ordre_du_jour: ordreduJour,
          slides: slides,
          use_llm: useLLM
        })
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Erreur lors de l'analyse: ${error.message}`);
    }
  }

  /**
   * Verifier la sante de l'API
   * @returns {Promise<boolean>} Etat de l'API
   */
  static async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET'
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export default PVAPIClient;
