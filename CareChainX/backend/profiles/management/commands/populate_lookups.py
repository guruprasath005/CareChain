import os
from django.core.management.base import BaseCommand
from django.conf import settings
from profiles.models import InstitutionType, Speciality, DiagnosticFacility, RadiologyFacility,DegreeType,Country,Skill

class Command(BaseCommand):
    help = 'Populates the lookup tables from text files in the /data directory.'

    def handle(self, *args, **options):
        
        # A map of the model to its corresponding data file
        model_map = {
            DegreeType:'degree_types.txt',
            Country:'country.txt',
            Skill:'skills.txt',
            InstitutionType: 'institution_types.txt',
            Speciality: 'specialities.txt',
            DiagnosticFacility: 'diagnostic_facilities.txt',
            RadiologyFacility: 'radiology_facilities.txt',
        }

        for model, filename in model_map.items():
            self.stdout.write(f"Populating {model.__name__}...")
            
            file_path = os.path.join(settings.BASE_DIR, 'data', filename)
            
            try:
                with open(file_path, 'r') as f:
                    count = 0
                    for line in f:
                        name = line.strip()
                        if name: # Ensure the line is not empty
                            obj, created = model.objects.get_or_create(name=name)
                            if created:
                                count += 1
                    self.stdout.write(self.style.SUCCESS(f'Successfully added {count} new {model.__name__} entries.'))
            except FileNotFoundError:
                self.stdout.write(self.style.ERROR(f'File not found: {file_path}. Skipping.'))
