CREATE TABLE IF NOT EXISTS tbl_featured_posts (
    featured_post_id INT NOT NULL AUTO_INCREMENT,
    branch_id INT NULL,
    title VARCHAR(180) NOT NULL,
    category VARCHAR(80) NOT NULL,
    content TEXT NOT NULL,
    media_type ENUM('Image','Video') NOT NULL DEFAULT 'Image',
    media_path VARCHAR(255) NOT NULL,
    status ENUM('Draft','Published','Archived') NOT NULL DEFAULT 'Draft',
    published_at DATETIME NULL,
    created_by_user_id INT NULL,
    updated_by_user_id INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (featured_post_id),
    KEY idx_featured_posts_status (status),
    KEY idx_featured_posts_branch (branch_id),
    KEY idx_featured_posts_published (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
