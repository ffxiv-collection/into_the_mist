-- Clean up old data
TRUNCATE TABLE mascots;

-- Insert the new specific pixel arts
INSERT INTO mascots (name, description, image_url) VALUES
('Samouraï', 'Maitrise le katana avec précision.', 'https://res.cloudinary.com/dd4rdtrig/image/upload/v1765676768/sprite_samoura%C3%AF_uvb3vk.webp'),
('Sage', 'Soigne et attaque avec ses Nouliths.', 'https://res.cloudinary.com/dd4rdtrig/image/upload/v1765676768/sprite_sage_ybjfif.webp'),
('Vipère', 'Double lame redoutable (Rôdeur).', 'https://res.cloudinary.com/dd4rdtrig/image/upload/v1765676767/sprite_rodeur_vipere_la36m3.webp');
