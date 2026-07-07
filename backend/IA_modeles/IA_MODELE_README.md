## Modèle IA

Le modèle entraîné (SmolVLM pour l'analyse de graphiques) est hébergé sur Hugging Face,
car il est trop volumineux (~2 Go) pour être versionné dans Git.

**Dépôt Hugging Face :** https://huggingface.co/amani12/smolvlm-graphes-v2

### Installation du modèle

Avant de lancer le backend, téléchargez le modèle avec la commande suivante
(depuis la racine du projet) :

```bash
hf download amani12/smolvlm-graphes-v2 --local-dir backend/IA_modeles/smolvlm-graphes-v2-merged
```

Cette commande crée le dossier `backend/IA_modeles/smolvlm-graphes-v2-merged/`
et y télécharge tous les fichiers du modèle.

> **Note :** l'outil `hf` fait partie de `huggingface_hub`. Si la commande n'est pas
> reconnue, installez-le avec : `pip install -U "huggingface_hub[cli]"`